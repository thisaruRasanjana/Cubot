#!/bin/bash

# Update Raspberry Pi Configuration for New IP Address
# Run this script on your Raspberry Pi after IP address change

set -e

echo "🔧 Updating Raspberry Pi configuration for new IP address..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current IP address
CURRENT_IP=$(hostname -I | awk '{print $1}')
echo -e "${YELLOW}Current Pi IP address: ${CURRENT_IP}${NC}"

# Project directory (adjust if needed)
PROJECT_DIR="/var/www/cubot"
BACKEND_DIR="/home/pi/cubot-backend"

echo "📁 Updating project files..."

# Update nginx configuration
echo "🌐 Updating nginx configuration..."
sudo cp cubot-nginx.conf /etc/nginx/sites-available/cubot
sudo nginx -t
sudo systemctl reload nginx

# Copy updated frontend build
echo "🎨 Deploying updated frontend..."
sudo rm -rf ${PROJECT_DIR}/*
sudo cp -r dist/* ${PROJECT_DIR}/
sudo chown -R www-data:www-data ${PROJECT_DIR}

# Update backend if running
echo "🔧 Updating backend configuration..."
if [ -d "${BACKEND_DIR}" ]; then
    # Copy updated backend files
    sudo cp app.py ${BACKEND_DIR}/
    sudo cp .env ${BACKEND_DIR}/
    
    # Restart backend service if it exists
    if sudo systemctl is-active --quiet cubot-backend; then
        echo "🔄 Restarting backend service..."
        sudo systemctl restart cubot-backend
    else
        echo "⚠️  Backend service not found. You may need to start it manually."
    fi
else
    echo "⚠️  Backend directory not found at ${BACKEND_DIR}"
fi

# Test connectivity
echo "🧪 Testing connectivity..."
sleep 2

# Test nginx
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200"; then
    echo -e "${GREEN}✅ Nginx is responding${NC}"
else
    echo -e "${RED}❌ Nginx is not responding${NC}"
fi

# Test backend API
if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health | grep -q "200"; then
    echo -e "${GREEN}✅ Backend API is responding${NC}"
else
    echo -e "${RED}❌ Backend API is not responding${NC}"
fi

echo -e "${GREEN}🎉 Configuration update complete!${NC}"
echo -e "${YELLOW}📱 You can now access the web app at:${NC}"
echo -e "   http://${CURRENT_IP}"
echo -e "   https://${CURRENT_IP} (if SSL is configured)"
echo ""
echo -e "${YELLOW}🔍 To verify ESP32 connection:${NC}"
echo -e "   curl http://${CURRENT_IP}/api/check_connection"
