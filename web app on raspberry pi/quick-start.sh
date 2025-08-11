#!/bin/bash

# Cubot Quick Start Script
# Simple script to start all services quickly

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="/Users/thisaruramanayake/Desktop/hardware project2/web app on raspberry pi"
PI_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}🚀 Starting Cubot Web App...${NC}"
echo "Raspberry Pi IP: $PI_IP"
echo ""

# Navigate to project directory
cd "$PROJECT_DIR"

# Check if backend is running
if pgrep -f "python3 app.py" > /dev/null; then
    echo -e "${GREEN}✅ Backend already running${NC}"
else
    echo "Starting backend..."
    python3 app.py &
    sleep 5
fi

# Check if nginx is running
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx already running${NC}"
else
    echo "Starting nginx..."
    sudo systemctl start nginx
fi

# Test connectivity
echo ""
echo "Testing connectivity..."
sleep 3

# Test backend
if curl -s http://localhost:5001/api/system-status > /dev/null; then
    echo -e "${GREEN}✅ Backend responding${NC}"
else
    echo -e "${YELLOW}⚠️  Backend not responding${NC}"
fi

# Test nginx proxy
if curl -s http://localhost/api/system-status > /dev/null; then
    echo -e "${GREEN}✅ Nginx proxy working${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx proxy not responding${NC}"
fi

# Test HTTPS
if curl -s -k https://localhost/api/system-status > /dev/null; then
    echo -e "${GREEN}✅ HTTPS working${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS not responding${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Cubot is ready!${NC}"
echo ""
echo "Access URLs:"
echo "  • Local:   http://localhost"
echo "  • Network: http://$PI_IP"
echo "  • HTTPS:   https://$PI_IP"
echo ""
echo "Mobile Access:"
echo "  • Open browser on phone"
echo "  • Navigate to: https://$PI_IP"
echo "  • Accept certificate warning"
echo "  • Allow camera access"
echo ""
echo "Logs:"
echo "  • Backend: tail -f app.log"
echo "  • Nginx:   sudo tail -f /var/log/nginx/error.log"
echo ""
echo "Stop services:"
echo "  • Ctrl+C to stop backend"
echo "  • sudo systemctl stop nginx"
