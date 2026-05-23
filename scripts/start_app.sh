#!/bin/bash
set -e

APP_DIR=/home/ec2-user/anomaly
BACKEND_DIR=$APP_DIR/backend
FRONTEND_DIR=$APP_DIR/frontend/my-app

echo "=== ApplicationStart: Starting services ==="

# ── Load env vars from AWS SSM Parameter Store ───────────────────────────────
echo "Fetching environment variables from SSM..."
export SUPABASE_URL=$(aws ssm get-parameter --name "/anomaly/SUPABASE_URL" --with-decryption --query "Parameter.Value" --output text)
export SUPABASE_KEY=$(aws ssm get-parameter --name "/anomaly/SUPABASE_KEY" --with-decryption --query "Parameter.Value" --output text)
export JWT_SECRET=$(aws ssm get-parameter --name "/anomaly/JWT_SECRET" --with-decryption --query "Parameter.Value" --output text)
export TELEGRAM_BOT_TOKEN=$(aws ssm get-parameter --name "/anomaly/TELEGRAM_BOT_TOKEN" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "")
export TELEGRAM_CHAT_ID=$(aws ssm get-parameter --name "/anomaly/TELEGRAM_CHAT_ID" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "")

# ── Write backend .env (always from root path) ───────────────────────────────
echo "Writing backend .env..."
cat > $BACKEND_DIR/.env << EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}
JWT_SECRET=${JWT_SECRET}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ALERT_EMAIL=
EOF

# ── Write frontend .env.local ─────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=$(aws ssm get-parameter --name "/anomaly/NEXT_PUBLIC_SUPABASE_URL" --with-decryption --query "Parameter.Value" --output text)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$(aws ssm get-parameter --name "/anomaly/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" --with-decryption --query "Parameter.Value" --output text)
NEXT_PUBLIC_API_URL=$(aws ssm get-parameter --name "/anomaly/NEXT_PUBLIC_API_URL" --with-decryption --query "Parameter.Value" --output text)

cat > $FRONTEND_DIR/.env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
EOF

# ── Start Flask backend with PM2 ──────────────────────────────────────────────
echo "Starting Flask backend..."
cd $BACKEND_DIR
pm2 delete anomaly-backend 2>/dev/null || true
pm2 start "python3.11 app.py" \
    --name anomaly-backend \
    --cwd $BACKEND_DIR \
    --env production \
    --log /var/log/anomaly-backend.log \
    --error /var/log/anomaly-backend-error.log

# ── Start Next.js frontend with PM2 ──────────────────────────────────────────
echo "Starting Next.js frontend..."
cd $FRONTEND_DIR
pm2 delete anomaly-frontend 2>/dev/null || true
pm2 start "npm start" \
    --name anomaly-frontend \
    --cwd $FRONTEND_DIR \
    --log /var/log/anomaly-frontend.log \
    --error /var/log/anomaly-frontend-error.log

# ── Save PM2 process list so it restarts on reboot ───────────────────────────
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user | tail -1 | bash || true

echo "=== ApplicationStart: Done ==="
echo "Backend running on port 5000"
echo "Frontend running on port 3000"
