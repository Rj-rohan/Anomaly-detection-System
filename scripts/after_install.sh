#!/bin/bash
set -e

APP_DIR=/home/ec2-user/anomaly
BACKEND_DIR=$APP_DIR/backend
FRONTEND_DIR=$APP_DIR/frontend/my-app

echo "=== AfterInstall: Extracting and installing ==="

# ── Extract packages ──────────────────────────────────────────────────────────
cd $APP_DIR
unzip -o backend-build.zip -d $APP_DIR
unzip -o frontend-build.zip -d $FRONTEND_DIR

# ── Install Python dependencies ───────────────────────────────────────────────
echo "Installing Python dependencies..."
pip3.11 install -r $BACKEND_DIR/requirements.txt

# ── Install Node dependencies ─────────────────────────────────────────────────
echo "Installing Node dependencies..."
cd $FRONTEND_DIR && npm install --production

# ── Write .env files from CodeDeploy environment variables ───────────────────
# These env vars are set in CodeBuild project environment variables
echo "Writing .env files..."

cat > $BACKEND_DIR/.env << EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}
JWT_SECRET=${JWT_SECRET}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-}
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ALERT_EMAIL=
EOF

cat > $FRONTEND_DIR/.env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
EOF

mkdir -p $BACKEND_DIR/models
chown -R ec2-user:ec2-user $APP_DIR

echo "=== AfterInstall: Done ==="
