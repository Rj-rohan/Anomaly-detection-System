from db import supabase
from alerts import dispatch_alert
from ml_model import predict as ml_predict, train as ml_train
from datetime import datetime, timezone, timedelta

# ── thresholds ────────────────────────────────────────────────────────────────
FAILED_THRESHOLD      = 5      # A1: failures in window
FAILED_WINDOW_MIN     = 10     # A1: sliding window minutes
UNUSUAL_HOUR_START    = 22     # A2: 10 PM
UNUSUAL_HOUR_END      = 6      # A2: 6 AM
RESTRICTED_START      = 20     # A8: 8 PM org policy
RESTRICTED_END        = 8      # A8: 8 AM org policy
FREQ_WINDOW_HOURS     = 24     # A4
FREQ_THRESHOLD        = 10     # A4
AVG_TRAVEL_SPEED_KMPH = 900    # A7

# ── decay & window config ─────────────────────────────────────────────────────
DECAY_FACTOR          = 0.8    # exponential decay: new = old * 0.8 + event_score
SUCCESS_DECAY         = 0.3    # on clean login: risk = risk * 0.3
CONSECUTIVE_CLEAN     = 3      # clean logins needed to apply success decay
SCORE_CAP             = 100    # max score (0-100 scale)

# ── severity (updated scale) ──────────────────────────────────────────────────
def _severity(score: float) -> str:
    if score >= 86: return "Critical"
    if score >= 61: return "High"
    if score >= 31: return "Medium"
    return "Low"


def _parse_dt(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _haversine_km(loc1: str, loc2: str) -> float:
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


def _get_previous_risk(user_id: str) -> float:
    """Get the most recent risk score for this user (for decay calculation)."""
    rows = (
        supabase.table("alerts")
        .select("risk_score, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return 0.0
    return float(rows[0]["risk_score"])


def analyze(user_id: str, user_name: str, login_status: str, timestamp: str,
            current_device: str = "Unknown", current_location: str = "Unknown"):

    event_score = 0
    reasons = []
    now = _parse_dt(timestamp)
    # Convert to IST (UTC+5:30) for hour-based checks
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now + ist_offset
    hour = now_ist.hour

    # Fetch last 50 logs (sliding window source)
    all_logs = (
        supabase.table("login_logs")
        .select("status, timestamp, device, location")
        .eq("user_id", user_id)
        .order("timestamp", desc=True)
        .limit(50)
        .execute()
        .data
    )

    profile_rows = supabase.table("user_profiles").select("*").eq("user_id", user_id).limit(1).execute().data
    profile = profile_rows[0] if profile_rows else None

    # ── SUCCESS PATH: decay on clean login ───────────────────────────────────
    if login_status == "success":
        # Check consecutive clean logins (no anomalies in recent logs)
        recent_success = [
            l for l in all_logs
            if l["status"] == "success"
            and (now - _parse_dt(l["timestamp"])).total_seconds() <= 86400  # last 24h
        ]
        if len(recent_success) >= CONSECUTIVE_CLEAN:
            prev_risk = _get_previous_risk(user_id)
            if prev_risk > 0:
                # Reduce previous risk heavily on verified clean behavior
                decayed = round(prev_risk * SUCCESS_DECAY, 1)
                reasons.append(
                    f"DECAY: {CONSECUTIVE_CLEAN}+ consecutive clean logins — "
                    f"risk reduced from {prev_risk} to {decayed}"
                )
                # Insert a decay record as a Low alert to track the reduction
                supabase.table("alerts").insert({
                    "user_id": user_id,
                    "risk_score": int(decayed),
                    "reason": " | ".join(reasons),
                    "severity": "Low",
                    "status": "closed",
                }).execute()
                _update_profile(user_id, hour, current_device, current_location, profile)
                _retrain(user_id, all_logs, profile)
                return

        # A3: Consecutive failures → sudden success (still suspicious even on success)
        if len(all_logs) >= 4:
            recent_4 = all_logs[:4]
            if all(l["status"] == "failed" for l in recent_4):
                event_score += 20
                reasons.append("A3: Consecutive failures followed by sudden success (possible credential guess)")

        if event_score == 0:
            _update_profile(user_id, hour, current_device, current_location, profile)
            _retrain(user_id, all_logs, profile)
            return

    # ── FAILED PATH: sliding window anomaly detection ─────────────────────────

    # A1: Failed attempts — SLIDING WINDOW only (last 10 min)
    if login_status == "failed":
        window_10m = now - timedelta(minutes=FAILED_WINDOW_MIN)
        recent_failed = [
            l for l in all_logs
            if l["status"] == "failed"
            and _parse_dt(l["timestamp"]) >= window_10m
        ]
        if len(recent_failed) >= FAILED_THRESHOLD:
            event_score += 40
            reasons.append(
                f"A1: {len(recent_failed)} failed attempts in last {FAILED_WINDOW_MIN} min "
                f"(threshold: {FAILED_THRESHOLD})"
            )

    # A2: Unusual timing — event-based, not cumulative
    is_unusual = hour >= UNUSUAL_HOUR_START or hour < UNUSUAL_HOUR_END
    if is_unusual:
        event_score += 30
        reasons.append(f"A2: Unusual login timing ({hour:02d}:00 IST — outside 6AM–10PM IST)")

    # A4: Excessive frequency — SLIDING WINDOW (last 24h)
    window_24h = now - timedelta(hours=FREQ_WINDOW_HOURS)
    logins_24h = [l for l in all_logs if _parse_dt(l["timestamp"]) >= window_24h]
    if len(logins_24h) > FREQ_THRESHOLD:
        event_score += 15
        reasons.append(f"A4: {len(logins_24h)} logins in last 24h (threshold: {FREQ_THRESHOLD})")

    # A5: New device — only flag if user has established device history (3+ known)
    if profile and current_device not in ("Unknown", "Other"):
        known_devices = profile.get("known_devices") or []
        if len(known_devices) >= 3 and current_device not in known_devices:
            event_score += 15
            reasons.append(f"A5: New device ({current_device})")

    # A6: New location — only flag if user has established location history (3+ known)
    if profile and current_location != "Unknown":
        known_locs = profile.get("known_locations") or []
        if len(known_locs) >= 3 and current_location not in known_locs:
            event_score += 20
            reasons.append(f"A6: Unexpected location ({current_location})")

    # A7: Impossible travel
    if current_location != "Unknown" and all_logs:
        prev_with_loc = [l for l in all_logs if l.get("location") and l["location"] != "Unknown"]
        if prev_with_loc:
            prev = prev_with_loc[0]
            prev_loc = prev["location"]
            prev_time = _parse_dt(prev["timestamp"])
            time_diff_hrs = max((now - prev_time).total_seconds() / 3600, 0.01)
            if prev_loc != current_location:
                dist_km = _haversine_km(prev_loc, current_location)
                speed = dist_km / time_diff_hrs
                if speed > AVG_TRAVEL_SPEED_KMPH and time_diff_hrs < 2:
                    event_score += 35
                    reasons.append(
                        f"A7: Impossible travel ({prev_loc} → {current_location} "
                        f"in {time_diff_hrs:.1f}h, ~{int(speed)} km/h)"
                    )

    # A8: Restricted hours
    is_restricted = hour >= RESTRICTED_START or hour < RESTRICTED_END
    if is_restricted and not is_unusual:
        event_score += 20
        reasons.append(f"A8: Restricted hours violation ({hour:02d}:00 IST)")
    elif is_restricted and is_unusual:
        event_score += 5
        reasons.append("A8: Also violates org restricted hours")

    # A9: Repeated alerts — CONTEXT ONLY, time-decayed, does NOT add to score
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    past_alerts = (
        supabase.table("alerts")
        .select("risk_score, created_at")
        .eq("user_id", user_id)
        .gte("created_at", month_start.isoformat())
        .neq("severity", "Low")   # exclude decay records
        .execute()
        .data
    )
    if len(past_alerts) >= 5:
        reasons.append(
            f"A9 [context]: {len(past_alerts)} alerts this month — "
            f"repeated suspicious pattern (no score added)"
        )

    # ── ML: Isolation Forest ──────────────────────────────────────────────────
    window_10m_start = now - timedelta(minutes=10)
    failed_10m = sum(
        1 for l in all_logs
        if l["status"] == "failed" and _parse_dt(l["timestamp"]) >= window_10m_start
    )
    ml_result = ml_predict(user_id, {
        "timestamp": timestamp,
        "status": login_status,
        "device": current_device,
        "location": current_location,
        "failed_last_10m": failed_10m,
        "logins_last_24h": max(len(logins_24h), 1),
    }, profile)

    ml_score = 0
    if ml_result.get("active") and ml_result.get("is_anomaly") and event_score > 0:
        # Only add ML score if rule engine already detected something
        # Prevents ML from triggering alerts on its own for minor deviations
        ml_score = ml_result.get("ml_score", 0)
        if ml_score > 0:
            reasons.append(
                f"ML: Isolation Forest anomaly "
                f"(raw={ml_result['anomaly_score']}, +{ml_score})"
            )

    # ── EXPONENTIAL DECAY FORMULA ─────────────────────────────────────────────
    # final_score = previous_risk * 0.8 + current_event_score
    # This means old risk fades unless new events keep it high
    prev_risk = _get_previous_risk(user_id)
    current_event_total = event_score + ml_score

    if current_event_total == 0:
        _update_profile(user_id, hour, current_device, current_location, profile)
        _retrain(user_id, all_logs, profile)
        return

    final_score = round(prev_risk * DECAY_FACTOR + current_event_total, 1)
    final_score = min(final_score, SCORE_CAP)  # cap at 100

    severity = _severity(final_score)

    reasons.insert(0,
        f"Score: {prev_risk} × {DECAY_FACTOR} (decay) + {current_event_total} (event) = {final_score}"
    )

    alert = (
        supabase.table("alerts")
        .insert({
            "user_id": user_id,
            "risk_score": int(final_score),
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
        "notes": "Auto-blocked by system" if severity == "Critical" else "",
    }).execute()

    if severity == "Critical":
        supabase.table("users").update({"is_blocked": True}).eq("id", user_id).execute()
        reasons.append("AUTO-BLOCKED: Account blocked due to Critical risk score")

    dispatch_alert(user_name, int(final_score), reasons, severity)
    _update_profile(user_id, hour, current_device, current_location, profile)
    _retrain(user_id, all_logs, profile)


def _update_profile(user_id: str, hour: int, device: str, location: str, profile: dict):
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
    try:
        enriched = []
        for i, l in enumerate(all_logs):
            try:
                dt = _parse_dt(l["timestamp"])
            except Exception:
                continue
            w10 = dt - timedelta(minutes=10)
            failed_10m = sum(
                1 for prev in all_logs[:i]
                if prev["status"] == "failed" and _parse_dt(prev["timestamp"]) >= w10
            )
            logins_24h = sum(
                1 for prev in all_logs[:i]
                if _parse_dt(prev["timestamp"]) >= dt - timedelta(hours=24)
            )
            enriched.append({**l, "failed_last_10m": failed_10m, "logins_last_24h": max(logins_24h, 1)})
        ml_train(user_id, enriched, profile)
    except Exception:
        pass
