#!/bin/bash
set -e

APP_DIR=/home/ec2-user/anomaly
BACKEND_DIR=$APP_DIR/backend
FRONTEND_DIR=$APP_DIR/frontend/my-app

echo "=== ApplicationStart: Starting services ==="

# ── Load backend env from .env file ──────────────────────────────────────────
if [ -f "$BACKEND_DIR/.env" ]; then
    export $(grep -v '^#' $BACKEND_DIR/.env | xargs)
    echo "Backend .env loaded"
else
    echo "ERROR: $BACKEND_DIR/.env not found"
    exit 1
fi

# ── Load frontend env from .env.local ────────────────────────────────────────
if [ -f "$FRONTEND_DIR/.env.local" ]; then
    echo "Frontend .env.local found"
else
    echo "ERROR: $FRONTEND_DIR/.env.local not found"
    exit 1
fi

# ── Start Flask backend with PM2 ──────────────────────────────────────────────
echo "Starting Flask backend..."
pm2 delete anomaly-backend 2>/dev/null || true
pm2 start "python3.11 app.py" \
    --name anomaly-backend \
    --cwd $BACKEND_DIR \
    --log /var/log/anomaly-backend.log \
    --error /var/log/anomaly-backend-error.log

# ── Start Next.js frontend with PM2 ──────────────────────────────────────────
echo "Starting Next.js frontend..."
pm2 delete anomaly-frontend 2>/dev/null || true
pm2 start "npm start" \
    --name anomaly-frontend \
    --cwd $FRONTEND_DIR \
    --log /var/log/anomaly-frontend.log \
    --error /var/log/anomaly-frontend-error.log

pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user | tail -1 | bash || true

echo "=== ApplicationStart: Done ==="
echo "Backend: port 5000 | Frontend: port 3000"
