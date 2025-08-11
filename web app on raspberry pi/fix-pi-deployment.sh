#!/bin/bash

# Fix Raspberry Pi Deployment for Correct Directory Structure
# Run this script on your Raspberry Pi from the project directory

set -e

echo "🔧 Fixing Raspberry Pi deployment configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current directory and IP
CURRENT_DIR=$(pwd)
CURRENT_IP=$(hostname -I | awk '{print $1}')
echo -e "${YELLOW}Current directory: ${CURRENT_DIR}${NC}"
echo -e "${YELLOW}Current Pi IP address: ${CURRENT_IP}${NC}"

# Project directories
PROJECT_DIR="/var/www/cubot"
BACKEND_DIR="${CURRENT_DIR}"

echo "📁 Updating project files from current directory..."

# Update nginx configuration with correct paths
echo "🌐 Updating nginx configuration..."
sudo cp cubot-nginx.conf /etc/nginx/sites-available/cubot

# Enable the site if not already enabled
if [ ! -L /etc/nginx/sites-enabled/cubot ]; then
    sudo ln -s /etc/nginx/sites-available/cubot /etc/nginx/sites-enabled/
    echo "✅ Enabled cubot nginx site"
fi

# Remove default nginx site if it exists
if [ -L /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
    echo "✅ Removed default nginx site"
fi

# Test nginx configuration
sudo nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
    sudo systemctl reload nginx
    echo "🔄 Reloaded nginx"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi

# Deploy updated frontend
echo "🎨 Deploying updated frontend..."
sudo mkdir -p ${PROJECT_DIR}
sudo rm -rf ${PROJECT_DIR}/*
sudo cp -r dist/* ${PROJECT_DIR}/
sudo chown -R www-data:www-data ${PROJECT_DIR}
echo -e "${GREEN}✅ Frontend deployed to ${PROJECT_DIR}${NC}"

# Update nginx configuration to point to correct frontend location
echo "📝 Updating nginx root path..."
sudo sed -i "s|root \".*\";|root \"${PROJECT_DIR}\";|g" /etc/nginx/sites-available/cubot
sudo nginx -t && sudo systemctl reload nginx

# Check if backend is running
echo "🔧 Checking backend status..."
BACKEND_PID=$(pgrep -f "python3 app.py" || echo "")

if [ -n "$BACKEND_PID" ]; then
    echo "🔄 Stopping existing backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID
    sleep 2
fi

# Start backend from current directory
echo "🚀 Starting backend from ${BACKEND_DIR}..."
cd "${BACKEND_DIR}"

# Check if app.py exists
if [ ! -f "app.py" ]; then
    echo -e "${RED}❌ app.py not found in current directory${NC}"
    echo "Please make sure you're running this script from the correct project directory"
    exit 1
fi

# Start backend in background
nohup python3 app.py > backend.log 2>&1 &
BACKEND_PID=$!
echo "🎯 Backend started with PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Test connectivity
echo "🧪 Testing connectivity..."

# Test nginx
echo "Testing nginx..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Nginx is responding (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Nginx is not responding (HTTP $HTTP_CODE)${NC}"
    echo "Checking nginx status..."
    sudo systemctl status nginx --no-pager -l
fi

# Test backend API
echo "Testing backend API..."
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health || echo "000")
if [ "$API_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend API is responding (HTTP $API_CODE)${NC}"
else
    echo -e "${RED}❌ Backend API is not responding (HTTP $API_CODE)${NC}"
    echo "Checking backend logs..."
    tail -10 backend.log
fi

# Test ESP32 connection endpoint
echo "Testing ESP32 connection endpoint..."
ESP32_RESPONSE=$(curl -s http://localhost/api/check_connection | jq -r '.connected // "error"' 2>/dev/null || echo "error")
if [ "$ESP32_RESPONSE" = "false" ]; then
    echo -e "${YELLOW}⚠️  ESP32 not connected (expected if no ESP32 plugged in)${NC}"
elif [ "$ESP32_RESPONSE" = "true" ]; then
    echo -e "${GREEN}✅ ESP32 is connected${NC}"
else
    echo -e "${RED}❌ ESP32 connection endpoint error${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Deployment fix complete!${NC}"
echo -e "${YELLOW}📱 Access your web app at:${NC}"
echo -e "   http://${CURRENT_IP}"
echo -e "   https://${CURRENT_IP} (if SSL is configured)"
echo ""
echo -e "${YELLOW}🔍 Test commands:${NC}"
echo -e "   curl http://${CURRENT_IP}/api/health"
echo -e "   curl http://${CURRENT_IP}/api/check_connection"
echo ""
echo -e "${YELLOW}📊 Monitor backend:${NC}"
echo -e "   tail -f ${BACKEND_DIR}/backend.log"
echo ""
echo -e "${YELLOW}🔄 Restart services if needed:${NC}"
echo -e "   sudo systemctl restart nginx"
echo -e "   pkill -f 'python3 app.py' && nohup python3 app.py > backend.log 2>&1 &"
