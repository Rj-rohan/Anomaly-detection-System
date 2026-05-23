# AI-Assisted Behavioral Login Threat Detection and Incident Response System

## Project Overview

A full-stack web application that monitors user login behavior, detects anomalies using rule-based logic and a Machine Learning model (Isolation Forest), generates real-time alerts, and supports administrators and security analysts in investigating and resolving incidents.

---

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Frontend   | Next.js 16, Tailwind CSS, Recharts, react-simple-maps |
| Backend    | Python Flask                                        |
| Database   | Supabase (PostgreSQL)                               |
| Auth       | JWT (python-jose) + bcrypt                          |
| ML Model   | Scikit-learn Isolation Forest                       |
| Alerts     | Telegram Bot API + Email SMTP + In-app Toast        |
| Export     | CSV (alerts + logs), PDF (risk profile)             |

---

## Project Structure

```
Anomaly/
├── backend/
│   ├── models/                  ← Trained ML model files (per user .pkl)
│   ├── app.py                   ← Flask API (all routes)
│   ├── auth.py                  ← JWT token creation/verification + bcrypt
│   ├── db.py                    ← Supabase client
│   ├── risk_engine.py           ← 9 anomaly rules + ML + decay scoring
│   ├── ml_model.py              ← Isolation Forest train/predict
│   ├── generate_dataset.py      ← Synthetic dataset seeder + model trainer
│   ├── alerts.py                ← Telegram + Email alert dispatcher
│   ├── schema.sql               ← Database schema (run in Supabase)
│   ├── requirements.txt         ← Python dependencies
│   └── .env                     ← Environment variables
└── frontend/my-app/
    ├── app/
    │   ├── login/page.js        ← Login with attempt counter + cooldown
    │   ├── register/page.js
    │   ├── dashboard/
    │   │   ├── admin/           ← Dashboard, alerts, incidents, users
    │   │   │   ├── logs/        ← Splunk-style log search
    │   │   │   ├── map/         ← GeoIP world map
    │   │   │   └── risk-profile/← Per-user risk profile + PDF export
    │   │   ├── analyst/         ← Incidents, login logs
    │   │   └── user/            ← Activity, alerts, self-service actions
    │   └── layout.js
    ├── components/
    │   ├── Sidebar.js           ← Role-aware navigation
    │   ├── DashboardLayout.js   ← Auth guard + layout wrapper
    │   ├── AlertToaster.js      ← Real-time toast notifications
    │   ├── LiveFeed.js          ← Live event feed (5s polling)
    │   ├── GeoMap.js            ← World map component
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

alter table users add column if not exists is_blocked boolean default false;

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

Creates 5 demo users with 46 login logs each and trains an Isolation Forest model per user.

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
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key
JWT_SECRET=your_jwt_secret_key
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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
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
| admin | Dashboard, log search, GeoIP map, risk profiles, failed attempts, block/unblock/reset users, ML status, retrain, alerts, incidents, CSV/PDF export |
| analyst | Incidents (investigate/update), login logs |

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
  - 9 rule-based anomaly checks (sliding windows)
  - Isolation Forest ML prediction
  - Exponential decay scoring formula
        ↓
Risk Score = prev_risk × 0.8 + event_score  (capped at 100)
        ↓
Generate Alert + Incident
        ↓
If Critical → Auto-block user
        ↓
Dispatch Alert (Telegram + Email + In-app Toast)
        ↓
Admin notified → Analyst investigates → Incident resolved
```

---

## Anomaly Detection — 9 Rules

| # | Anomaly | Trigger | Event Score |
|---|---------|---------|-------------|
| A1 | Multiple Failed Login Attempts | ≥3 failed attempts within 10 min sliding window | +40 |
| A2 | Unusual Login Timing | Login between 10PM–6AM | +30 |
| A3 | Consecutive Failures → Sudden Success | 4 consecutive failures then success | +20 |
| A4 | Excessive Login Frequency | >10 logins in last 24h sliding window | +15 |
| A5 | New Device Login | Device not in user's known devices | +15 |
| A6 | Location Change Anomaly | Location not in user's known locations | +20 |
| A7 | Impossible Travel | Speed between two locations >900 km/h within 2h | +35 |
| A8 | Restricted Hours (Org Policy) | Login between 8PM–8AM | +20 |
| A9 | Repeated Alert History | ≥5 alerts this month — context info only, no score added | — |

> A9 is shown as context information only. It does not add to the score to prevent score inflation.

---

## Risk Scoring Engine — Industry-Grade Design

### The Problem with Naive Scoring
Simple additive scoring causes **score inflation** — every event adds to a running total, so even normal users eventually become Critical. Real security systems avoid this.

### Solution: Three-Layer Approach

#### 1. Sliding Time Windows
Each anomaly only evaluates events within a fixed recent window:
- A1: last **10 minutes** only
- A4: last **24 hours** only
- Events outside the window are completely ignored

```
10:00 AM → 3 failures in 10 min → A1 fires (+40)
11:00 AM → those failures are now outside the window → A1 does NOT fire
```

#### 2. Exponential Decay Formula
```
final_score = previous_risk × 0.8 + current_event_score
```
Old risk fades unless new events keep it elevated:

```
10:00 AM: prev=0,  event=40 → final = 0×0.8 + 40 = 40  (Medium)
11:00 AM: prev=40, event=0  → no alert generated
12:00 PM: prev=40, event=40 → final = 40×0.8 + 40 = 72 (High)
01:00 PM: prev=72, event=0  → no alert generated
02:00 PM: prev=72, event=0  → no alert generated
  (score naturally decays in the background)
```

#### 3. Success Decay (Behavior Reset)
After **3 consecutive clean logins** within 24 hours:
```
new_risk = previous_risk × 0.3
```
A user at 60 (Medium) who logs in cleanly 3 times → drops to 18 (Low).
This rewards normal behavior and prevents permanent flagging.

#### Score Cap
Final score is always capped at **100** regardless of how many anomalies fire simultaneously.

### Severity Levels (Updated)

| Score | Severity | Auto-block? |
|-------|----------|-------------|
| 0–30 | Low | No |
| 31–60 | Medium | No |
| 61–85 | High | No |
| 86–100 | Critical | Yes — automatic |

### Scoring Example

```
Previous risk score:       40  (from earlier brute-force)
Current event:
  A1: 3 failures in 10 min = +40
  A2: Login at 2AM         = +30
  ML: Isolation Forest     = +18
  Total event score        = 88

Final = 40 × 0.8 + 88 = 120 → capped at 100 → Critical → AUTO-BLOCKED
```

---

## Auto-Block System

When a user's final risk score reaches **Critical (≥86)**:
1. `is_blocked = true` set in database immediately
2. All future login attempts return `403 Account is blocked`
3. Alert reason includes `AUTO-BLOCKED` tag
4. Incident created with note "Auto-blocked by system"
5. Admin can manually unblock from Users page or Dashboard

Manual block/unblock is also available for any user at any risk level.

---

## Login Screen Security Warnings

The login page shows progressive warnings based on failed attempt count:

| Attempts | UI Response |
|----------|-------------|
| 1 | Plain error message |
| 2 | Yellow warning — "1 more will trigger a security alert" |
| 3+ | Red danger banner — "Security Alert — reported to security team" |
| 3+ | Sign In button **disabled** for **5 minutes** with live countdown |
| Blocked | Sign In button permanently disabled — "Contact administrator" |

A progress bar shows `X / 3 threshold` turning red at the threshold.

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

## Alert Format

```
🔴 Security Alert — Critical

User: Rohan Sharma
Risk Score: 100
Anomalies Detected:
• Score: 40 × 0.8 (decay) + 88 (event) = 100
• A1: 3 failed attempts in last 10 min (threshold: 3)
• A2: Unusual login timing (02:00 — outside 6AM–10PM)
• ML: Isolation Forest anomaly (raw=-0.42, +18)
• AUTO-BLOCKED: Account blocked due to Critical risk score
Severity: Critical
```

Sent via: Telegram Bot + Email SMTP + In-app Toast notification

---

## Real-Time Alert Toast (In-App)

The `AlertToaster` component polls `/api/alerts` every **5 seconds** on admin and analyst dashboards:
- Sets a baseline timestamp on first load
- Only shows toasts for alerts created **after** the dashboard was opened
- Deduplicates using a shown-IDs set
- Auto-dismisses after **8 seconds**
- Shows severity badge + all anomaly reasons + AUTO-BLOCKED tag if applicable
- Max 5 toasts visible simultaneously

---

## Splunk-Style Log Search (`/dashboard/admin/logs`)

- Full-text search across user, IP, location, device, browser
- Filter by status (success/failed) and date range
- Events-per-hour bar chart (last 24h)
- Top 10 source IPs with bar indicators
- Top 10 locations with bar indicators
- Export all logs to CSV

---

## GeoIP Map (`/dashboard/admin/map`)

- World map with login pins (green = success, red = failed)
- Hover tooltip: user, location, status, timestamp
- Filter by all / success / failed
- Zoomable and pannable
- Table of recent mapped events below map

---

## User Risk Profile (`/dashboard/admin/risk-profile`)

- Select any user from dropdown
- Risk score history line chart
- Behavior baseline: avg login hour, known devices, known locations
- Full alert history with all anomaly bullets
- Account status (Active / Blocked)
- Export to PDF (jsPDF)
- Accessible via "Profile" button on failed attempts table

---

## CSV / PDF Export

| Export | Format | Access | Content |
|--------|--------|--------|---------|
| Alerts | CSV | Admin | All alerts with user, score, severity, reason |
| Login Logs | CSV | Admin | All login events with IP, device, location |
| Risk Profile | PDF | Admin | Per-user risk history, baseline, alert list |

---

## Live Event Feed

The `LiveFeed` component on the admin dashboard:
- Combines alerts + login events into a single chronological feed
- Auto-refreshes every **5 seconds**
- Live/Pause toggle
- Color-coded: red border for alerts, gray for login events
- Shows user, message, severity, timestamp

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
| is_blocked | boolean | Account blocked flag (manual or auto) |
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
| risk_score | int | Final decayed risk score (0–100) |
| reason | text | Pipe-separated anomaly list including decay formula |
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
| GET | /api/logs | admin, analyst | All login logs |
| GET | /api/logs/me | Any auth | Current user's login history |
| GET | /api/logs/search | admin, analyst | Splunk-style search with filters |
| GET | /api/logs/stats | admin, analyst | Hourly chart, top IPs, top locations |
| GET | /api/logs/geo | admin, analyst | Geocoded login points for map |

### Alerts & Incidents
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/alerts | admin, analyst | All alerts with user info |
| GET | /api/incidents | admin, analyst | All incidents |
| PATCH | /api/incidents/:id | admin, analyst | Update incident status and notes |
| GET | /api/feed/latest | admin, analyst | Live feed — alerts + logins combined |

### Dashboard
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/dashboard/stats | admin, analyst | Summary stats |
| GET | /api/dashboard/risk_trend | admin, analyst | Risk score over time |
| GET | /api/dashboard/failed-by-user | admin | Failed attempts per user |

### User Management (Admin)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/users | admin | All users list |
| PATCH | /api/users/:id/block | admin | Block a user |
| PATCH | /api/users/:id/unblock | admin | Unblock a user |
| PATCH | /api/users/:id/reset-password | admin | Reset user password |
| GET | /api/users/:id/risk-profile | admin, analyst | Full risk profile for a user |

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

### Export
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/export/alerts | admin | Download alerts as CSV |
| GET | /api/export/logs | admin | Download login logs as CSV |

---

## Dashboard Features

### Admin Dashboard
- Stat cards: Total Users, Total Alerts, High Risk Alerts, Failed Logins
- Quick action buttons: Export Alerts CSV, Export Logs CSV, Risk Profiles, GeoIP Map
- Failed Login Attempts by User — Block/Unblock, Reset Password, View Profile
- ML Model Status panel — Trained/Not Trained per user, Retrain All button
- Risk Score Trend line chart
- Live Event Feed (5s auto-refresh, pause/resume)
- Recent Alerts panel

### Admin Sub-pages
- **Alerts** — Full table with anomaly bullet list, risk bar, severity, status
- **Incidents** — All incidents with severity and status badges
- **Log Search** — Splunk-style search, hourly chart, top IPs/locations, CSV export
- **GeoIP Map** — World map with login pins, filter, hover tooltips
- **Risk Profile** — Per-user risk history chart, baseline, alert history, PDF export
- **Users** — All users with Active/Blocked status, Block/Unblock action

### Analyst Dashboard
- Incident counts by status
- Recent incidents table

### Analyst Sub-pages
- **Incidents** — Investigate modal with status update, notes, full anomaly list
- **Login Logs** — All login events with IP, device, location, browser

### User Dashboard
- Successful / Failed login counts
- Report Suspicious Activity (creates incident)
- Change Password
- Security Alerts panel — all anomalies with severity + risk score + decay formula
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

1. **Rule-based + ML hybrid** — Rules catch known patterns, ML catches unknown behavioral deviations
2. **Exponential decay scoring** — `score = prev × 0.8 + event` prevents score inflation; old risk fades naturally
3. **Sliding time windows** — A1 uses last 10 min, A4 uses last 24h; events outside window are ignored
4. **Success decay** — 3 consecutive clean logins reduce risk by 70%, rewarding normal behavior
5. **A9 context-only** — Repeated alert history shown as info, not added to score (prevents compounding)
6. **Score cap at 100** — No matter how many anomalies fire, score never exceeds 100
7. **Auto-block at Critical (≥86)** — Immediate account lock on Critical, admin can manually unblock
8. **Per-user ML models** — Each user has their own Isolation Forest, not a global model
9. **Auto-retraining** — Model retrains after every login, continuously adapts to behavior
10. **Server-side geolocation** — IP resolved to city/region/country using ip-api.com
11. **Single admin** — Admin pre-seeded only; registration API blocks `admin` role
12. **Incident lifecycle** — Every alert auto-creates an incident (New → Investigating → Resolved/Escalated)
13. **Login screen warnings** — Progressive UI feedback at 2 and 3 failures, 5-min cooldown after threshold
