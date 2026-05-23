#!/bin/bash
set -e

APP_DIR=/home/ec2-user/anomaly
BACKEND_DIR=$APP_DIR/backend
FRONTEND_DIR=$APP_DIR/frontend

echo "=== AfterInstall: Extracting and installing ==="

# ── Extract backend ──────────────────────────────────────────────────────────
echo "Extracting backend..."
cd $APP_DIR
unzip -o backend-build.zip -d $APP_DIR
# backend/ folder is now at $APP_DIR/backend/

# ── Install backend Python dependencies ──────────────────────────────────────
echo "Installing Python dependencies..."
cd $BACKEND_DIR
pip3.11 install -r requirements.txt

# ── Extract frontend ──────────────────────────────────────────────────────────
echo "Extracting frontend..."
cd $APP_DIR
unzip -o frontend-build.zip -d $FRONTEND_DIR

# ── Install frontend Node dependencies (production only) ─────────────────────
echo "Installing Node dependencies..."
cd $FRONTEND_DIR/my-app
npm install --production

# ── Ensure models directory exists ───────────────────────────────────────────
mkdir -p $BACKEND_DIR/models

# ── Set permissions ───────────────────────────────────────────────────────────
chown -R ec2-user:ec2-user $APP_DIR

echo "=== AfterInstall: Done ==="
