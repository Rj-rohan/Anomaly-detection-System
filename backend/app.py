from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timezone
from functools import wraps
import requests as http
from user_agents import parse as parse_ua
from db import supabase
from auth import hash_password, verify_password, create_token, decode_token
from risk_engine import analyze

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

# ── helpers ──────────────────────────────────────────────────────────────────

def get_token():
    h = request.headers.get("Authorization", "")
    return h.replace("Bearer ", "") if h.startswith("Bearer ") else None

def require_auth(roles=None):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            token = get_token()
            if not token:
                return jsonify({"error": "Unauthorized"}), 401
            try:
                payload = decode_token(token)
            except Exception:
                return jsonify({"error": "Invalid token"}), 401
            if roles and payload.get("role") not in roles:
                return jsonify({"error": "Forbidden"}), 403
            request.user = payload
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def get_location(ip: str) -> str:
    try:
        if ip in ("127.0.0.1", "::1", "localhost"):
            # local dev — use your own public IP
            pub = http.get("https://api.ipify.org", timeout=3).text.strip()
            ip = pub
        r = http.get(f"http://ip-api.com/json/{ip}?fields=city,regionName,country", timeout=3).json()
        if r.get("city"):
            return f"{r['city']}, {r['regionName']}, {r['country']}"
    except Exception:
        pass
    return "Unknown"

# ── auth routes ───────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
def register():
    d = request.json
    role = d.get("role", "user")
    if role == "admin":
        return jsonify({"error": "Cannot register as admin"}), 403
    existing = supabase.table("users").select("id").eq("email", d["email"]).limit(1).execute().data
    if existing:
        return jsonify({"error": "Email already registered"}), 400
    user = supabase.table("users").insert({
        "name": d["name"],
        "email": d["email"],
        "password": hash_password(d["password"]),
        "role": role,
    }).execute().data[0]
    token = create_token({"sub": user["id"], "role": user["role"], "name": user["name"]})
    return jsonify({"token": token, "user": {k: user[k] for k in ("id","name","email","role")}})

@app.post("/api/auth/login")
def login():
    d = request.json
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    ua = request.headers.get("User-Agent", "")
    ts = now_iso()

    rows = supabase.table("users").select("*").eq("email", d["email"]).limit(1).execute().data
    user = rows[0] if rows else None

    if user and user.get("is_blocked"):
        return jsonify({"error": "Account is blocked. Contact administrator."}), 403

    status = "success" if user and verify_password(d["password"], user["password"]) else "failed"

    uid = user["id"] if user else None
    uname = user["name"] if user else d["email"]

    if uid:
        parsed_ua = parse_ua(ua)
        device = parsed_ua.device.family if parsed_ua.device.family != "Other" else parsed_ua.os.family
        browser = f"{parsed_ua.browser.family} {parsed_ua.browser.version_string}".strip()
        location = get_location(ip)
        supabase.table("login_logs").insert({
            "user_id": uid,
            "timestamp": ts,
            "status": status,
            "ip_address": ip,
            "device": device or "Unknown",
            "browser": browser[:120] or "Unknown",
            "location": location,
        }).execute()
        analyze(uid, uname, status, ts, current_device=device or "Unknown", current_location=location)

    if status == "failed":
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_token({"sub": user["id"], "role": user["role"], "name": user["name"]})
    return jsonify({"token": token, "user": {k: user[k] for k in ("id","name","email","role")}})

@app.get("/api/auth/me")
@require_auth()
def me():
    uid = request.user["sub"]
    user = supabase.table("users").select("id,name,email,role,created_at").eq("id", uid).single().execute().data
    return jsonify(user)

# ── login logs ────────────────────────────────────────────────────────────────

@app.get("/api/logs")
@require_auth(["admin", "analyst"])
def get_logs():
    uid = request.args.get("user_id")
    q = supabase.table("login_logs").select("*, users(name,email)").order("timestamp", desc=True).limit(200)
    if uid:
        q = q.eq("user_id", uid)
    return jsonify(q.execute().data)

@app.get("/api/logs/me")
@require_auth()
def my_logs():
    uid = request.user["sub"]
    data = supabase.table("login_logs").select("*").eq("user_id", uid).order("timestamp", desc=True).limit(50).execute().data
    return jsonify(data)

# ── alerts ────────────────────────────────────────────────────────────────────

@app.get("/api/alerts")
@require_auth(["admin", "analyst"])
def get_alerts():
    data = supabase.table("alerts").select("*, users(name,email)").order("created_at", desc=True).limit(100).execute().data
    return jsonify(data)

# ── incidents ─────────────────────────────────────────────────────────────────

@app.get("/api/incidents")
@require_auth(["admin", "analyst"])
def get_incidents():
    data = supabase.table("incidents").select("*, alerts(*, users(name,email))").order("updated_at", desc=True).limit(100).execute().data
    return jsonify(data)

@app.patch("/api/incidents/<inc_id>")
@require_auth(["analyst", "admin"])
def update_incident(inc_id):
    d = request.json
    updated = supabase.table("incidents").update({
        "status": d.get("status"),
        "notes": d.get("notes"),
        "assigned_to": request.user["sub"],
        "updated_at": now_iso(),
    }).eq("id", inc_id).execute().data
    return jsonify(updated[0] if updated else {})

# ── dashboard stats ───────────────────────────────────────────────────────────

@app.get("/api/dashboard/stats")
@require_auth(["admin", "analyst"])
def dashboard_stats():
    users_count = len(supabase.table("users").select("id").execute().data)
    alerts_data = supabase.table("alerts").select("severity, status").execute().data
    high_risk = sum(1 for a in alerts_data if a["severity"] == "High")
    open_alerts = sum(1 for a in alerts_data if a["status"] == "open")
    logs = supabase.table("login_logs").select("status").execute().data
    failed = sum(1 for l in logs if l["status"] == "failed")
    return jsonify({
        "total_users": users_count,
        "total_alerts": len(alerts_data),
        "high_risk_alerts": high_risk,
        "open_alerts": open_alerts,
        "failed_logins": failed,
    })

@app.get("/api/dashboard/risk_trend")
@require_auth(["admin", "analyst"])
def risk_trend():
    data = supabase.table("alerts").select("created_at, risk_score, severity").order("created_at").limit(50).execute().data
    return jsonify(data)

# ── users list (admin) ────────────────────────────────────────────────────────

@app.get("/api/users")
@require_auth(["admin"])
def list_users():
    data = supabase.table("users").select("id,name,email,role,created_at,is_blocked").order("created_at", desc=True).execute().data
    return jsonify(data)

@app.get("/api/dashboard/failed-by-user")
@require_auth(["admin"])
def failed_by_user():
    logs = supabase.table("login_logs").select("user_id, status, timestamp, users(name,email,is_blocked)").eq("status", "failed").order("timestamp", desc=True).limit(500).execute().data
    counts = {}
    for l in logs:
        uid = l["user_id"]
        if uid not in counts:
            counts[uid] = {
                "user_id": uid,
                "name": l["users"]["name"],
                "email": l["users"]["email"],
                "is_blocked": l["users"].get("is_blocked", False),
                "failed_count": 0,
                "last_attempt": l["timestamp"],
            }
        counts[uid]["failed_count"] += 1
    result = sorted(counts.values(), key=lambda x: x["failed_count"], reverse=True)
    return jsonify(result)

@app.patch("/api/users/<uid>/block")
@require_auth(["admin"])
def block_user(uid):
    supabase.table("users").update({"is_blocked": True}).eq("id", uid).execute()
    return jsonify({"message": "User blocked"})

@app.patch("/api/users/<uid>/unblock")
@require_auth(["admin"])
def unblock_user(uid):
    supabase.table("users").update({"is_blocked": False}).eq("id", uid).execute()
    return jsonify({"message": "User unblocked"})

@app.patch("/api/users/<uid>/reset-password")
@require_auth(["admin"])
def reset_password(uid):
    d = request.json
    new_pass = d.get("password")
    if not new_pass or len(new_pass) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    supabase.table("users").update({"password": hash_password(new_pass)}).eq("id", uid).execute()
    return jsonify({"message": "Password reset successfully"})

# ── user self-actions ─────────────────────────────────────────────────────────

@app.get("/api/users/me/alerts")
@require_auth()
def my_alerts():
    uid = request.user["sub"]
    data = supabase.table("alerts").select("*").eq("user_id", uid).order("created_at", desc=True).limit(10).execute().data
    return jsonify(data)

@app.post("/api/users/me/report")
@require_auth()
def report_suspicious():
    uid = request.user["sub"]
    d = request.json
    alert = supabase.table("alerts").insert({
        "user_id": uid,
        "risk_score": 50,
        "reason": f"User self-reported: {d.get('reason', 'Suspicious activity')}",
        "severity": "Medium",
        "status": "open",
    }).execute().data[0]
    supabase.table("incidents").insert({"alert_id": alert["id"], "status": "New", "notes": "Self-reported by user"}).execute()
    return jsonify({"message": "Report submitted"})

@app.post("/api/users/me/secure")
@require_auth()
def secure_account():
    uid = request.user["sub"]
    d = request.json
    new_pass = d.get("password")
    if not new_pass or len(new_pass) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    supabase.table("users").update({"password": hash_password(new_pass)}).eq("id", uid).execute()
    # Clear login logs to reset anomaly baseline
    return jsonify({"message": "Password updated successfully"})

# ── ML endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/ml/retrain")
@require_auth(["admin"])
def ml_retrain_all():
    from ml_model import train as ml_train
    from datetime import datetime, timedelta
    users = supabase.table("users").select("id,name").execute().data
    results = []
    for u in users:
        uid = u["id"]
        logs = supabase.table("login_logs").select("*").eq("user_id", uid).order("timestamp", desc=True).limit(100).execute().data
        profile_rows = supabase.table("user_profiles").select("*").eq("user_id", uid).limit(1).execute().data
        profile = profile_rows[0] if profile_rows else None
        enriched = []
        for i, l in enumerate(logs):
            try:
                dt = datetime.fromisoformat(l["timestamp"].replace("Z", "+00:00"))
                w10 = dt - timedelta(minutes=10)
                failed_10m = sum(1 for p in logs[:i] if p["status"] == "failed" and datetime.fromisoformat(p["timestamp"].replace("Z", "+00:00")) >= w10)
                logins_24h = sum(1 for p in logs[:i] if datetime.fromisoformat(p["timestamp"].replace("Z", "+00:00")) >= dt - timedelta(hours=24))
                enriched.append({**l, "failed_last_10m": failed_10m, "logins_last_24h": max(logins_24h, 1)})
            except Exception:
                continue
        trained = ml_train(uid, enriched, profile)
        results.append({"user": u["name"], "trained": trained, "samples": len(enriched)})
    return jsonify(results)

@app.get("/api/ml/status")
@require_auth(["admin"])
def ml_status():
    from pathlib import Path
    models_dir = Path("models")
    users = supabase.table("users").select("id,name,role").execute().data
    result = []
    for u in users:
        log_count = len(supabase.table("login_logs").select("id").eq("user_id", u["id"]).execute().data)
        result.append({
            "name": u["name"],
            "role": u["role"],
            "model_trained": (models_dir / f"{u['id']}.pkl").exists(),
            "log_count": log_count,
        })
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
