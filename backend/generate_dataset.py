"""
Generate synthetic login dataset for existing users and seed into Supabase.
Also trains the Isolation Forest model for each user after seeding.

Normal behavior pattern per user:
  - Login hours: 8AM–6PM on weekdays
  - Device: Windows
  - Location: user's home city

Injected anomalies (~10% of logs):
  - Late night logins (1AM–4AM)
  - Failed login bursts
  - New device (Linux)
  - New location (different city)
"""
import random
from datetime import datetime, timedelta, timezone
from db import supabase
from auth import hash_password
from ml_model import train, extract_features

random.seed(42)

CITIES = [
    "Pune, Maharashtra, India",
    "Mumbai, Maharashtra, India",
    "Delhi, Delhi, India",
    "Bangalore, Karnataka, India",
    "Hyderabad, Telangana, India",
]

DEVICES = ["Windows", "MacOS", "Linux", "Android", "iPhone"]
BROWSERS = ["Chrome 124.0", "Firefox 115.0", "Safari 17.0", "Edge 120.0"]

DEMO_USERS = [
    {"name": "Rohan Sharma",   "email": "rohan@demo.com",   "password": "Demo@1234", "home_city": CITIES[0], "device": "Windows"},
    {"name": "Priya Patel",    "email": "priya@demo.com",   "password": "Demo@1234", "home_city": CITIES[1], "device": "MacOS"},
    {"name": "Arjun Singh",    "email": "arjun@demo.com",   "password": "Demo@1234", "home_city": CITIES[2], "device": "Windows"},
    {"name": "Sneha Reddy",    "email": "sneha@demo.com",   "password": "Demo@1234", "home_city": CITIES[3], "device": "Windows"},
    {"name": "Vikram Nair",    "email": "vikram@demo.com",  "password": "Demo@1234", "home_city": CITIES[4], "device": "MacOS"},
]

ANALYST_USERS = [
    {"name": "Analyst One",  "email": "analyst1@demo.com", "password": "Demo@1234"},
    {"name": "Analyst Two",  "email": "analyst2@demo.com", "password": "Demo@1234"},
]


def rand_dt(days_ago_max=30, days_ago_min=1, hour_min=8, hour_max=22):
    days_ago = random.randint(days_ago_min, days_ago_max)
    hour = random.randint(hour_min, hour_max)
    minute = random.randint(0, 59)
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.replace(hour=hour, minute=minute, second=random.randint(0, 59), microsecond=0)


def generate_logs_for_user(user_id, home_city, device, n_normal=60, n_anomaly=6):
    logs = []

    # Normal logins — business hours, known device, home city
    for _ in range(n_normal):
        dt = rand_dt(days_ago_max=30, hour_min=8, hour_max=18)
        # Occasionally a failed attempt (1 in 8)
        status = "failed" if random.random() < 0.12 else "success"
        logs.append({
            "user_id": user_id,
            "timestamp": dt.isoformat(),
            "status": status,
            "ip_address": f"192.168.{random.randint(1,10)}.{random.randint(1,254)}",
            "device": device,
            "browser": random.choice(BROWSERS),
            "location": home_city,
        })

    # Anomalous logins
    for i in range(n_anomaly):
        dt = rand_dt(days_ago_max=10, hour_min=1, hour_max=4)  # late night
        anomaly_type = i % 3

        if anomaly_type == 0:
            # Late night + new location
            loc = random.choice([c for c in CITIES if c != home_city])
            dev = device
            status = "success"
        elif anomaly_type == 1:
            # Failed burst
            loc = home_city
            dev = device
            status = "failed"
        else:
            # New device + new location
            loc = random.choice([c for c in CITIES if c != home_city])
            dev = random.choice([d for d in DEVICES if d != device])
            status = "success"

        logs.append({
            "user_id": user_id,
            "timestamp": dt.isoformat(),
            "status": status,
            "ip_address": f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
            "device": dev,
            "browser": random.choice(BROWSERS),
            "location": loc,
        })

    # Sort by timestamp
    logs.sort(key=lambda x: x["timestamp"])
    return logs


def seed_user(u, role="user"):
    existing = supabase.table("users").select("id").eq("email", u["email"]).limit(1).execute().data
    if existing:
        uid = existing[0]["id"]
        print(f"  User exists: {u['email']} ({uid})")
    else:
        row = supabase.table("users").insert({
            "name": u["name"],
            "email": u["email"],
            "password": hash_password(u["password"]),
            "role": role,
        }).execute().data[0]
        uid = row["id"]
        print(f"  Created user: {u['email']} ({uid})")
    return uid


def seed_logs(user_id, logs):
    # Delete old seeded logs to avoid duplicates on re-run
    # Insert in batches of 20
    for i in range(0, len(logs), 20):
        batch = logs[i:i+20]
        supabase.table("login_logs").insert(batch).execute()
    print(f"  Seeded {len(logs)} login logs")


def build_profile(user_id, home_city, device):
    existing = supabase.table("user_profiles").select("id").eq("user_id", user_id).limit(1).execute().data
    profile_data = {
        "user_id": user_id,
        "avg_login_hour": 11,
        "common_login_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "avg_failed_attempts": 1,
        "known_devices": [device],
        "known_locations": [home_city],
    }
    if existing:
        supabase.table("user_profiles").update({k: v for k, v in profile_data.items() if k != "user_id"}).eq("user_id", user_id).execute()
    else:
        supabase.table("user_profiles").insert(profile_data).execute()
    print(f"  Profile set: device={device}, location={home_city}")
    return profile_data


def train_model(user_id, logs, profile):
    # Enrich logs with computed features needed by extract_features
    from datetime import datetime
    enriched = []
    for i, l in enumerate(logs):
        try:
            dt = datetime.fromisoformat(l["timestamp"].replace("Z", "+00:00"))
        except Exception:
            continue
        window_start = dt - timedelta(minutes=10)
        failed_10m = sum(
            1 for prev in logs[:i]
            if prev["status"] == "failed"
            and datetime.fromisoformat(prev["timestamp"].replace("Z", "+00:00")) >= window_start
        )
        day_start = dt - timedelta(hours=24)
        logins_24h = sum(
            1 for prev in logs[:i]
            if datetime.fromisoformat(prev["timestamp"].replace("Z", "+00:00")) >= day_start
        )
        enriched.append({**l, "failed_last_10m": failed_10m, "logins_last_24h": max(logins_24h, 1)})

    success = train(user_id, enriched, profile)
    if success:
        print(f"  ML model trained on {len(enriched)} samples")
    else:
        print(f"  Not enough samples to train ({len(enriched)} < 10)")


if __name__ == "__main__":
    print("\n=== Seeding Demo Users ===")
    for u in DEMO_USERS:
        print(f"\n[{u['name']}]")
        uid = seed_user(u, role="user")
        logs = generate_logs_for_user(uid, u["home_city"], u["device"])
        seed_logs(uid, logs)
        profile = build_profile(uid, u["home_city"], u["device"])
        train_model(uid, logs, profile)

    print("\n=== Seeding Analyst Users ===")
    for u in ANALYST_USERS:
        print(f"\n[{u['name']}]")
        uid = seed_user(u, role="analyst")

    print("\n=== Done ===")
    print("\nDemo login credentials (all passwords: Demo@1234):")
    print("  Users   : rohan@demo.com, priya@demo.com, arjun@demo.com, sneha@demo.com, vikram@demo.com")
    print("  Analysts: analyst1@demo.com, analyst2@demo.com")
    print("  Admin   : admin@threatdetect.com / Admin@1234")
