#!/bin/bash
set -e

echo "=== BeforeInstall: Setting up environment ==="

# Install system dependencies
yum update -y
yum install -y python3.11 python3.11-pip nodejs npm unzip curl

# Install PM2 globally for process management
npm install -g pm2

# Create app directory
mkdir -p /home/ec2-user/anomaly
mkdir -p /home/ec2-user/anomaly/backend
mkdir -p /home/ec2-user/anomaly/frontend
mkdir -p /home/ec2-user/anomaly/backend/models

# Set ownership
chown -R ec2-user:ec2-user /home/ec2-user/anomaly

echo "=== BeforeInstall: Done ==="
