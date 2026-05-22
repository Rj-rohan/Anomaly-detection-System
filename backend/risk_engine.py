from db import supabase
from alerts import dispatch_alert
from ml_model import predict as ml_predict, train as ml_train, extract_features
from datetime import datetime, timezone, timedelta

# ── thresholds ────────────────────────────────────────────────────────────────
FAILED_THRESHOLD       = 5      # A1
FAILED_WINDOW_MIN      = 10
UNUSUAL_HOUR_START     = 22     # A2: 10 PM
UNUSUAL_HOUR_END       = 6      # A2: 6 AM
RESTRICTED_START       = 20     # A8: 8 PM  (org policy)
RESTRICTED_END         = 8      # A8: 8 AM
FREQ_WINDOW_HOURS      = 24     # A4
FREQ_THRESHOLD         = 10     # A4: >10 logins/day suspicious
TRAVEL_WINDOW_MIN      = 60     # A7: impossible travel window
AVG_TRAVEL_SPEED_KMPH  = 900    # A7: max realistic speed (flight)
REPEAT_ALERT_THRESHOLD = 5      # A9: alerts this month


def _severity(score: int) -> str:
    if score > 100: return "Critical"
    if score >= 61: return "High"
    if score >= 31: return "Medium"
    return "Low"


def _parse_dt(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _haversine_km(loc1: str, loc2: str) -> float:
    """Rough distance estimate by geocoding city names via nominatim."""
    import requests
    def geocode(place):
        try:
            r = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": place, "format": "json", "limit": 1},
                headers={"User-Agent": "anomaly-detector/1.0"},
                timeout=4,
            )
            data = r.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception:
            pass
        return None

    from math import radians, sin, cos, sqrt, atan2
    c1 = geocode(loc1)
    c2 = geocode(loc2)
    if not c1 or not c2:
        return 0.0
    lat1, lon1 = map(radians, c1)
    lat2, lon2 = map(radians, c2)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return 6371 * 2 * atan2(sqrt(a), sqrt(1 - a))


def analyze(user_id: str, user_name: str, login_status: str, timestamp: str,
            current_device: str = "Unknown", current_location: str = "Unknown"):

    score = 0
    reasons = []
    now = _parse_dt(timestamp)
    hour = now.hour

    # Fetch last 50 login logs for this user
    all_logs = (
        supabase.table("login_logs")
        .select("status, timestamp, device, location")
        .eq("user_id", user_id)
        .order("timestamp", desc=True)
        .limit(50)
        .execute()
        .data
    )

    # Fetch user profile
    rows = supabase.table("user_profiles").select("*").eq("user_id", user_id).limit(1).execute().data
    profile = rows[0] if rows else None

    # ── A1: Multiple Failed Login Attempts ───────────────────────────────────
    recent_failed = [
        l for l in all_logs
        if l["status"] == "failed"
        and (now - _parse_dt(l["timestamp"])).total_seconds() <= FAILED_WINDOW_MIN * 60
    ]
    if len(recent_failed) >= FAILED_THRESHOLD:
        score += 40
        reasons.append(f"A1: Multiple failed login attempts ({len(recent_failed)} in {FAILED_WINDOW_MIN} min)")

    # ── A2: Unusual Login Timing (personal behavior) ──────────────────────────
    is_unusual_personal = hour >= UNUSUAL_HOUR_START or hour < UNUSUAL_HOUR_END
    if is_unusual_personal:
        score += 30
        reasons.append(f"A2: Unusual login timing ({hour:02d}:00 — outside normal hours)")

    # ── A3: Consecutive Failures Followed by Sudden Success ──────────────────
    if login_status == "success" and len(all_logs) >= 4:
        recent_4 = all_logs[:4]  # most recent 4 before this login
        if all(l["status"] == "failed" for l in recent_4):
            score += 20
            reasons.append("A3: Consecutive failures followed by sudden success (possible credential guess)")

    # ── A4: Excessive Login Frequency ────────────────────────────────────────
    window_start = now - timedelta(hours=FREQ_WINDOW_HOURS)
    logins_today = [
        l for l in all_logs
        if _parse_dt(l["timestamp"]) >= window_start
    ]
    if len(logins_today) > FREQ_THRESHOLD:
        score += 15
        reasons.append(f"A4: Excessive login frequency ({len(logins_today)} logins in last {FREQ_WINDOW_HOURS}h)")

    # ── A5: New Device Login ──────────────────────────────────────────────────
    if profile and current_device not in ("Unknown", "Other"):
        known_devices = profile.get("known_devices") or []
        if known_devices and current_device not in known_devices:
            score += 15
            reasons.append(f"A5: New device detected ({current_device} — not in known devices)")

    # ── A6: Location Change Anomaly ───────────────────────────────────────────
    if profile and current_location not in ("Unknown",):
        known_locs = profile.get("known_locations") or []
        if known_locs and current_location not in known_locs:
            score += 20
            reasons.append(f"A6: Unexpected location ({current_location} — not in known locations)")

    # ── A7: Impossible Travel ─────────────────────────────────────────────────
    if current_location not in ("Unknown",) and all_logs:
        prev_logs_with_loc = [l for l in all_logs if l.get("location") and l["location"] != "Unknown"]
        if prev_logs_with_loc:
            prev = prev_logs_with_loc[0]
            prev_loc = prev["location"]
            prev_time = _parse_dt(prev["timestamp"])
            time_diff_hrs = max((now - prev_time).total_seconds() / 3600, 0.01)
            if prev_loc != current_location:
                dist_km = _haversine_km(prev_loc, current_location)
                speed = dist_km / time_diff_hrs
                if speed > AVG_TRAVEL_SPEED_KMPH and time_diff_hrs < 2:
                    score += 35
                    reasons.append(
                        f"A7: Impossible travel detected ({prev_loc} -> {current_location} "
                        f"in {time_diff_hrs:.1f}h, ~{int(speed)} km/h)"
                    )

    # ── A8: Login During Restricted Hours (org policy) ────────────────────────
    is_restricted = hour >= RESTRICTED_START or hour < RESTRICTED_END
    if is_restricted and not is_unusual_personal:
        # Only add if A2 didn't already fire (avoid double-counting same window)
        score += 20
        reasons.append(f"A8: Login during restricted hours ({hour:02d}:00 — policy: {RESTRICTED_END}AM–{RESTRICTED_START%12}PM)")
    elif is_restricted and is_unusual_personal:
        # A2 already fired, give partial extra for policy violation
        score += 5
        reasons.append(f"A8: Also violates org restricted hours policy")

    # ── A9: Repeated Alert History ────────────────────────────────────────────
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    past_alerts = (
        supabase.table("alerts")
        .select("id")
        .eq("user_id", user_id)
        .gte("created_at", month_start.isoformat())
        .execute()
        .data
    )
    if len(past_alerts) >= REPEAT_ALERT_THRESHOLD:
        score += 25
        reasons.append(f"A9: Repeated suspicious activity ({len(past_alerts)} alerts this month)")

    # ── ML: Isolation Forest prediction ──────────────────────────────────────
    window_start_10m = now - timedelta(minutes=10)
    failed_10m = sum(
        1 for l in all_logs
        if l["status"] == "failed"
        and _parse_dt(l["timestamp"]) >= window_start_10m
    )
    logins_24h = sum(
        1 for l in all_logs
        if _parse_dt(l["timestamp"]) >= now - timedelta(hours=24)
    )
    current_log_features = {
        "timestamp": timestamp,
        "status": login_status,
        "device": current_device,
        "location": current_location,
        "failed_last_10m": failed_10m,
        "logins_last_24h": max(logins_24h, 1),
    }
    ml_result = ml_predict(user_id, current_log_features, profile)

    if score == 0 and not ml_result.get("is_anomaly"):
        _update_profile(user_id, hour, current_device, current_location, profile)
        _retrain(user_id, all_logs, profile)
        return

    # Add ML score to rule score
    ml_score = ml_result.get("ml_score", 0)
    if ml_result.get("active") and ml_result.get("is_anomaly"):
        score += ml_score
        reasons.append(f"ML: Isolation Forest anomaly detected (score: {ml_result['anomaly_score']}, contribution: +{ml_score})")

    if score == 0:
        _update_profile(user_id, hour, current_device, current_location, profile)
        _retrain(user_id, all_logs, profile)
        return

    severity = _severity(score)

    alert = (
        supabase.table("alerts")
        .insert({
            "user_id": user_id,
            "risk_score": min(score, 150),
            "reason": " | ".join(reasons),
            "severity": severity,
            "status": "open",
        })
        .execute()
        .data[0]
    )

    supabase.table("incidents").insert({
        "alert_id": alert["id"],
        "status": "New",
        "notes": "",
    }).execute()

    dispatch_alert(user_name, score, reasons, severity)

    _update_profile(user_id, hour, current_device, current_location, profile)
    _retrain(user_id, all_logs, profile)


def _update_profile(user_id: str, hour: int, device: str, location: str, profile: dict):
    """Update or create user baseline profile."""
    if profile:
        known_devices = list(set((profile.get("known_devices") or []) + ([device] if device != "Unknown" else [])))
        known_locs = list(set((profile.get("known_locations") or []) + ([location] if location != "Unknown" else [])))
        old_avg = profile.get("avg_login_hour") or hour
        new_avg = round((old_avg + hour) / 2, 1)
        supabase.table("user_profiles").update({
            "avg_login_hour": new_avg,
            "known_devices": known_devices[:20],
            "known_locations": known_locs[:20],
        }).eq("user_id", user_id).execute()
    else:
        supabase.table("user_profiles").insert({
            "user_id": user_id,
            "avg_login_hour": hour,
            "known_devices": [device] if device != "Unknown" else [],
            "known_locations": [location] if location != "Unknown" else [],
        }).execute()


def _retrain(user_id: str, all_logs: list, profile: dict):
    """Retrain Isolation Forest model for this user using latest logs."""
    try:
        enriched = []
        for i, l in enumerate(all_logs):
            try:
                dt = _parse_dt(l["timestamp"])
            except Exception:
                continue
            window_10m = dt - timedelta(minutes=10)
            failed_10m = sum(
                1 for prev in all_logs[:i]
                if prev["status"] == "failed"
                and _parse_dt(prev["timestamp"]) >= window_10m
            )
            logins_24h = sum(
                1 for prev in all_logs[:i]
                if _parse_dt(prev["timestamp"]) >= dt - timedelta(hours=24)
            )
            enriched.append({**l, "failed_last_10m": failed_10m, "logins_last_24h": max(logins_24h, 1)})
        ml_train(user_id, enriched, profile)
    except Exception:
        pass
