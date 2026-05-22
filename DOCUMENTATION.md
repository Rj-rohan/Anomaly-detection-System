# AI-Assisted Behavioral Login Threat Detection and Incident Response System

## Project Overview

A full-stack web application that monitors user login behavior, detects anomalies using rule-based logic and a Machine Learning model (Isolation Forest), generates real-time alerts, and supports administrators and security analysts in investigating and resolving incidents.

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | Next.js 16, Tailwind CSS, Recharts |
| Backend    | Python Flask                      |
| Database   | Supabase (PostgreSQL)             |
| Auth       | JWT (python-jose) + bcrypt        |
| ML Model   | Scikit-learn Isolation Forest     |
| Alerts     | Telegram Bot API + Email SMTP     |

---

## Project Structure

```
Anomaly/
├── backend/
│   ├── models/                  ← Trained ML model files (per user .pkl)
│   ├── app.py                   ← Flask API (all routes)
│   ├── auth.py                  ← JWT token creation/verification + bcrypt
│   ├── db.py                    ← Supabase client
│   ├── risk_engine.py           ← 9 anomaly rules + ML integration
│   ├── ml_model.py              ← Isolation Forest train/predict
│   ├── generate_dataset.py      ← Synthetic dataset seeder + model trainer
│   ├── alerts.py                ← Telegram + Email alert dispatcher
│   ├── schema.sql               ← Database schema (run in Supabase)
│   ├── requirements.txt         ← Python dependencies
│   └── .env                     ← Environment variables
└── frontend/my-app/
    ├── app/
    │   ├── login/page.js
    │   ├── register/page.js
    │   ├── dashboard/
    │   │   ├── admin/           ← Admin dashboard + alerts + incidents + users
    │   │   ├── analyst/         ← Analyst dashboard + incidents + logs
    │   │   └── user/            ← User activity + security alerts + actions
    │   └── layout.js
    ├── components/
    │   ├── Sidebar.js           ← Role-aware navigation
    │   ├── DashboardLayout.js   ← Auth guard + layout wrapper
    │   └── ui.js                ← StatCard, SeverityBadge, RiskBar, etc.
    ├── lib/
    │   ├── api.js               ← All API call functions
    │   └── AuthContext.js       ← Global auth state (JWT)
    └── .env.local               ← Frontend environment variables
```

---

## Setup Instructions

### Step 1 — Supabase Database

Run `backend/schema.sql` in your Supabase SQL Editor:

```sql
create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  password text not null,
  role text not null default 'user' check (role in ('user','admin','analyst')),
  is_blocked boolean default false,
  created_at timestamptz default now()
);

create table if not exists login_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  timestamp timestamptz not null,
  status text not null check (status in ('success','failed')),
  ip_address text,
  device text,
  browser text,
  location text
);

create table if not exists user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique references users(id) on delete cascade,
  avg_login_hour numeric,
  common_login_days text[],
  avg_failed_attempts numeric default 0,
  known_devices text[] default '{}',
  known_locations text[] default '{}'
);

create table if not exists alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  risk_score int not null,
  reason text,
  severity text check (severity in ('Low','Medium','High','Critical')),
  status text default 'open' check (status in ('open','closed')),
  created_at timestamptz default now()
);

create table if not exists incidents (
  id uuid primary key default uuid_generate_v4(),
  alert_id uuid references alerts(id) on delete cascade,
  assigned_to uuid references users(id),
  notes text default '',
  status text default 'New' check (status in ('New','Investigating','Resolved','Escalated')),
  updated_at timestamptz default now()
);

alter table users disable row level security;
alter table login_logs disable row level security;
alter table user_profiles disable row level security;
alter table alerts disable row level security;
alter table incidents disable row level security;

-- Add is_blocked if upgrading existing schema
alter table users add column if not exists is_blocked boolean default false;

-- Update severity constraint if upgrading
alter table alerts drop constraint if exists alerts_severity_check;
alter table alerts add constraint alerts_severity_check
  check (severity in ('Low','Medium','High','Critical'));
```

### Step 2 — Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Runs on: `http://localhost:5000`

### Step 3 — Seed Demo Data + Train ML Models

```bash
cd backend
python generate_dataset.py
```

This creates 5 demo users with 46 login logs each and trains an Isolation Forest model per user.

### Step 4 — Frontend

```bash
cd frontend/my-app
npm install
npm run dev
```

Runs on: `http://localhost:3000`

---

## Environment Variables

### backend/.env

```
SUPABASE_URL=https://lrbaejmalycgqvyvymqf.supabase.co
SUPABASE_KEY=<your_supabase_service_key>
JWT_SECRET=super-secret-jwt-key-change-in-production
TELEGRAM_BOT_TOKEN=          # optional
TELEGRAM_CHAT_ID=            # optional
SMTP_HOST=smtp.gmail.com     # optional
SMTP_PORT=587                # optional
SMTP_USER=                   # optional
SMTP_PASS=                   # optional
ALERT_EMAIL=                 # optional
```

### frontend/my-app/.env.local

```
NEXT_PUBLIC_SUPABASE_URL=https://lrbaejmalycgqvyvymqf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your_publishable_key>
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Login Credentials

### Admin (pre-seeded, cannot be registered)
| Email | Password |
|-------|----------|
| admin@threatdetect.com | Admin@1234 |

### Demo Users (seeded by generate_dataset.py)
| Email | Password | Home City |
|-------|----------|-----------|
| rohan@demo.com | Demo@1234 | Pune |
| priya@demo.com | Demo@1234 | Mumbai |
| arjun@demo.com | Demo@1234 | Delhi |
| sneha@demo.com | Demo@1234 | Bangalore |
| vikram@demo.com | Demo@1234 | Hyderabad |

### Demo Analysts
| Email | Password |
|-------|----------|
| analyst1@demo.com | Demo@1234 |
| analyst2@demo.com | Demo@1234 |

---

## Roles and Access

| Role | Access |
|------|--------|
| user | Login, view own login history, view own security alerts, report suspicious activity, change password |
| admin | Dashboard, failed attempts by user, block/unblock users, reset passwords, ML model status, retrain models, alerts, incidents, users list |
| analyst | Incidents (investigate/update status/notes), login logs |

> Admin account is pre-seeded only. Registration is restricted to `user` and `analyst` roles.

---

## System Workflow

```
User Login Attempt
        ↓
Authentication (bcrypt password verify)
        ↓
Check if account is blocked → 403 if blocked
        ↓
Capture Metadata:
  - Timestamp
  - IP Address (auto-detected)
  - Location (ip-api.com geolocation)
  - Device (parsed from User-Agent)
  - Browser (parsed from User-Agent)
        ↓
Store in login_logs table
        ↓
Anomaly Detection Layer (risk_engine.py)
        ↓
Risk Engine → Generate Alert + Incident
        ↓
Dispatch Alert (Telegram + Email)
        ↓
Admin notified → Analyst investigates → Incident resolved
```

---

## Anomaly Detection — 9 Rules

| # | Anomaly | Trigger | Risk Score |
|---|---------|---------|------------|
| A1 | Multiple Failed Login Attempts | ≥5 failed attempts within 10 minutes | +40 |
| A2 | Unusual Login Timing | Login between 10PM–6AM | +30 |
| A3 | Consecutive Failures → Sudden Success | 4 consecutive failures then success | +20 |
| A4 | Excessive Login Frequency | >10 logins in 24 hours | +15 |
| A5 | New Device Login | Device not in user's known devices | +15 |
| A6 | Location Change Anomaly | Location not in user's known locations | +20 |
| A7 | Impossible Travel | Speed between two locations >900 km/h within 2 hours | +35 |
| A8 | Restricted Hours (Org Policy) | Login between 8PM–8AM (policy violation) | +20 |
| A9 | Repeated Alert History | ≥5 alerts generated this month | +25 |

---

## ML Model — Isolation Forest

### Why Isolation Forest?
- Unsupervised — no labeled attack data needed
- Learns each user's normal behavior from their own login history
- Detects outliers (anomalies) automatically
- Lightweight, per-user model, retrains after every login

### Feature Vector (7 features)

| Feature | Description |
|---------|-------------|
| hour | Hour of login (0–23) |
| day_of_week | Day of week (0=Mon … 6=Sun) |
| is_failed | 1 if login failed, 0 if success |
| failed_last_10m | Count of failures in last 10 minutes |
| logins_last_24h | Total logins in last 24 hours |
| is_new_device | 1 if device not in known devices |
| is_new_location | 1 if location not in known locations |

### How It Works
1. Minimum 10 login logs required before model activates (cold start protection)
2. Model trained on user's last 50 login logs
3. On each new login, model predicts anomaly score
4. Raw score mapped to 0–40 risk contribution
5. Model automatically retrains after every login
6. Admin can manually trigger retrain for all users via dashboard

### ML Score Contribution
```
Raw IF score: -0.5 (very anomalous) → 0.5 (very normal)
ML Risk Score = (-raw_score + 0.5) × 40   →   range: 0–40
```

---

## Risk Scoring

```
Final Risk Score = Rule Scores (A1–A9) + ML Score (0–40)
```

### Severity Levels

| Score | Severity |
|-------|----------|
| 0–30 | Low |
| 31–60 | Medium |
| 61–100 | High |
| >100 | Critical |

### Example

```
A1: Multiple failed attempts     = +40
A2: Unusual login timing         = +30
A7: Impossible travel            = +35
ML: Isolation Forest anomaly     = +28
─────────────────────────────────────
Total Risk Score                 = 133 → Critical
```

---

## Alert Format

```
🔴 Security Alert — Critical

User: Rohan Sharma
Risk Score: 133
Anomalies Detected:
• A1: Multiple failed login attempts (6 in 10 min)
• A2: Unusual login timing (02:00 — outside normal hours)
• A7: Impossible travel detected (Pune → New York in 0.5h, ~11200 km/h)
• ML: Isolation Forest anomaly detected (score: -0.42, contribution: +28)
Severity: Critical
```

Sent via: Telegram Bot + Email SMTP

---

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Full name |
| email | text | Unique email |
| password | text | bcrypt hashed |
| role | text | user / admin / analyst |
| is_blocked | boolean | Account blocked flag |
| created_at | timestamptz | Registration time |

### login_logs
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → users |
| timestamp | timestamptz | Login time |
| status | text | success / failed |
| ip_address | text | Client IP |
| device | text | Parsed from User-Agent |
| browser | text | Parsed from User-Agent |
| location | text | City, Region, Country (ip-api.com) |

### user_profiles
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → users (unique) |
| avg_login_hour | numeric | Rolling average login hour |
| common_login_days | text[] | Typical login days |
| avg_failed_attempts | numeric | Average failed attempts |
| known_devices | text[] | List of known devices |
| known_locations | text[] | List of known locations |

### alerts
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → users |
| risk_score | int | Calculated risk score |
| reason | text | Pipe-separated anomaly list |
| severity | text | Low / Medium / High / Critical |
| status | text | open / closed |
| created_at | timestamptz | Alert time |

### incidents
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| alert_id | uuid | FK → alerts |
| assigned_to | uuid | FK → users (analyst) |
| notes | text | Investigation notes |
| status | text | New / Investigating / Resolved / Escalated |
| updated_at | timestamptz | Last update time |

---

## API Endpoints

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/auth/register | Public | Register (user/analyst only) |
| POST | /api/auth/login | Public | Login, capture metadata, run anomaly detection |
| GET | /api/auth/me | Any auth | Get current user info |

### Logs
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/logs | admin, analyst | All login logs (filter by user_id) |
| GET | /api/logs/me | Any auth | Current user's login history |

### Alerts & Incidents
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/alerts | admin, analyst | All alerts with user info |
| GET | /api/incidents | admin, analyst | All incidents with alert + user info |
| PATCH | /api/incidents/:id | admin, analyst | Update incident status and notes |

### Dashboard
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/dashboard/stats | admin, analyst | Total users, alerts, high risk, failed logins |
| GET | /api/dashboard/risk_trend | admin, analyst | Risk score over time for chart |
| GET | /api/dashboard/failed-by-user | admin | Failed attempt counts per user with block status |

### User Management (Admin)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/users | admin | All users list |
| PATCH | /api/users/:id/block | admin | Block a user account |
| PATCH | /api/users/:id/unblock | admin | Unblock a user account |
| PATCH | /api/users/:id/reset-password | admin | Reset user password |

### User Self-Service
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/users/me/alerts | Any auth | Current user's own alerts |
| POST | /api/users/me/report | Any auth | Self-report suspicious activity |
| POST | /api/users/me/secure | Any auth | Change own password |

### ML
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/ml/status | admin | Model trained status per user |
| POST | /api/ml/retrain | admin | Retrain all user models |

---

## Dashboard Features

### Admin Dashboard
- Stat cards: Total Users, Total Alerts, High Risk Alerts, Failed Logins
- Failed Login Attempts by User table with Block/Unblock and Reset Password actions
- ML Model Status panel — shows Trained/Not Trained per user with Retrain All button
- Risk Score Trend line chart
- Recent Alerts panel

### Admin Sub-pages
- **Alerts** — Full alerts table with all anomaly reasons as bullet list, severity, risk bar
- **Incidents** — All incidents with severity, status badges
- **Users** — All registered users with roles

### Analyst Dashboard
- Incident counts by status (New, Investigating, Resolved)
- Recent incidents table

### Analyst Sub-pages
- **Incidents** — Investigate modal: update status (New/Investigating/Resolved/Escalated) + notes, full anomaly list
- **Login Logs** — All user login logs with IP, device, location, browser

### User Dashboard
- Successful logins count + Failed attempts count
- Report Suspicious Activity button (creates incident for security team)
- Change Password button
- Security Alerts panel — shows all anomalies detected on their account with severity + risk score
- Green "all clear" banner when no alerts
- Full login history table

---

## Synthetic Dataset (generate_dataset.py)

Generates realistic login history for demo users:

- **40 normal logins** per user: business hours (8AM–6PM), known device, home city
- **6 anomalous logins** per user:
  - Late night (1AM–4AM) + new location
  - Failed login burst
  - New device + new location
- Trains Isolation Forest model on all 46 logs per user
- Sets user profile with known devices and locations

---

## Python Dependencies (requirements.txt)

```
flask
flask-cors
supabase
python-jose[cryptography]
bcrypt
python-dotenv
requests
user-agents
scikit-learn
numpy
joblib
```

---

## Key Design Decisions

1. **Rule-based + ML hybrid** — Rules catch known patterns (brute force, timing), ML catches unknown behavioral deviations
2. **Per-user ML models** — Each user has their own Isolation Forest trained on their own history, not a global model
3. **Auto-retraining** — Model retrains after every login so it continuously adapts to the user's behavior
4. **Explainable scoring** — Every alert shows exactly which anomalies fired and their individual score contributions
5. **Server-side geolocation** — IP resolved to city/region/country on the backend using ip-api.com
6. **Server-side UA parsing** — Device and browser extracted from User-Agent header using the `user-agents` library
7. **Single admin** — Admin account is pre-seeded only; registration API blocks `admin` role
8. **Incident lifecycle** — Every alert automatically creates an incident (New → Investigating → Resolved/Escalated)
