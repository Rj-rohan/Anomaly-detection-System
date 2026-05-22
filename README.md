# AI-Assisted Behavioral Login Threat Detection System

## Setup

### 1. Supabase Database
Run `backend/schema.sql` in your Supabase SQL Editor to create all tables.

### 2. Backend (Flask)
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Runs on http://localhost:5000

### 3. Frontend (Next.js)
```bash
cd frontend/my-app
npm install
npm run dev
```
Runs on http://localhost:3000

---

## Optional: Telegram Alerts
Set in `backend/.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Optional: Email Alerts
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
ALERT_EMAIL=admin@example.com
```

---

## Roles
| Role     | Access |
|----------|--------|
| user     | Login, view own history |
| admin    | Dashboard, alerts, incidents, users |
| analyst  | Incidents (investigate/update), login logs |

## Risk Engine
| Trigger | Score |
|---------|-------|
| 5+ failed logins in 10 min | +40 |
| Login between 10PM–6AM | +30 |
| Deviation from baseline profile | +20 |

**Severity:** 0–30 Low · 31–60 Medium · 61–100 High
