#!/bin/bash
set -e

echo "=== ValidateService: Checking services ==="

# Wait for services to start
sleep 10

# Check backend health
echo "Checking backend (port 5000)..."
for i in {1..5}; do
    if curl -sf http://localhost:5000/api/auth/me > /dev/null 2>&1 || \
       curl -sf http://localhost:5000 > /dev/null 2>&1; then
        echo "Backend is UP"
        break
    fi
    if [ $i -eq 5 ]; then
        echo "Backend health check failed"
        pm2 logs anomaly-backend --lines 20
        exit 1
    fi
    echo "Waiting for backend... attempt $i"
    sleep 5
done

# Check frontend health
echo "Checking frontend (port 3000)..."
for i in {1..5}; do
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo "Frontend is UP"
        break
    fi
    if [ $i -eq 5 ]; then
        echo "Frontend health check failed"
        pm2 logs anomaly-frontend --lines 20
        exit 1
    fi
    echo "Waiting for frontend... attempt $i"
    sleep 5
done

echo "=== ValidateService: All services running ==="
pm2 list
