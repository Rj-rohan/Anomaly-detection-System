#!/bin/bash

echo "=== ApplicationStop: Stopping services ==="

# Stop PM2 processes gracefully
pm2 stop anomaly-backend 2>/dev/null || true
pm2 stop anomaly-frontend 2>/dev/null || true
pm2 delete anomaly-backend 2>/dev/null || true
pm2 delete anomaly-frontend 2>/dev/null || true

echo "=== ApplicationStop: Done ==="
