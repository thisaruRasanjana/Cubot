#!/bin/bash

# Setup HTTPS for Camera Access on Raspberry Pi
# This script creates SSL certificates and configures nginx for HTTPS

set -e

echo "🔒 Setting up HTTPS for camera access..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current IP
CURRENT_IP=$(hostname -I | awk '{print $1}')
echo -e "${YELLOW}Setting up HTTPS for IP: ${CURRENT_IP}${NC}"

# Create SSL directory
sudo mkdir -p /etc/nginx/ssl
cd /etc/nginx/ssl

# Generate self-signed SSL certificate
echo "🔑 Generating SSL certificate..."
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout cubot.key \
    -out cubot.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=${CURRENT_IP}"

# Set proper permissions
sudo chmod 600 cubot.key
sudo chmod 644 cubot.crt

# Create HTTPS nginx configuration
echo "🌐 Creating HTTPS nginx configuration..."
sudo tee /etc/nginx/sites-available/cubot-https > /dev/null << EOF
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name ${CURRENT_IP} localhost raspberrypi raspberrypi.local;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${CURRENT_IP} localhost raspberrypi raspberrypi.local;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cubot.crt;
    ssl_certificate_key /etc/nginx/ssl/cubot.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers for camera access
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    
    # Increase client max body size for image uploads
    client_max_body_size 50M;
    
    # Root directory for static files (built React app)
    root "/var/www/cubot";
    index index.html;
    
    # Error and access logs
    error_log /var/log/nginx/cubot_https_error.log;
    access_log /var/log/nginx/cubot_https_access.log;
    
    # Serve static files from the built React app
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
        
        # CORS headers for camera access
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
    }
    
    # Proxy API requests to Flask backend
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        
        # CORS for API requests
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
        
        # Handle preflight requests
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
        
        # Increase timeouts for image processing
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Handle uploads specifically
    location /api/upload {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Longer timeouts for image uploads
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # Large body size for images
        client_max_body_size 50M;
    }
}
EOF

# Enable HTTPS site and disable HTTP-only site
sudo rm -f /etc/nginx/sites-enabled/cubot
sudo ln -sf /etc/nginx/sites-available/cubot-https /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx HTTPS configuration is valid${NC}"
    sudo systemctl reload nginx
    echo "🔄 Reloaded nginx with HTTPS"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi

# Test HTTPS access
echo "🧪 Testing HTTPS access..."
sleep 2

# Test HTTPS (ignore certificate warnings for self-signed cert)
HTTPS_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost || echo "000")
if [ "$HTTPS_CODE" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS is responding (HTTP $HTTPS_CODE)${NC}"
else
    echo -e "${RED}❌ HTTPS is not responding (HTTP $HTTPS_CODE)${NC}"
fi

# Test API over HTTPS
API_HTTPS_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/api/health || echo "000")
if [ "$API_HTTPS_CODE" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS API is responding (HTTP $API_HTTPS_CODE)${NC}"
else
    echo -e "${RED}❌ HTTPS API is not responding (HTTP $API_HTTPS_CODE)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 HTTPS setup complete!${NC}"
echo -e "${YELLOW}📱 Access your web app with camera support at:${NC}"
echo -e "   https://${CURRENT_IP}"
echo ""
echo -e "${YELLOW}⚠️  Browser Security Warning:${NC}"
echo -e "   Your browser will show a security warning for the self-signed certificate."
echo -e "   Click 'Advanced' → 'Proceed to ${CURRENT_IP} (unsafe)' to continue."
echo ""
echo -e "${YELLOW}📷 Camera Access:${NC}"
echo -e "   Camera permissions should now work over HTTPS!"
echo ""
echo -e "${YELLOW}🔍 Test commands:${NC}"
echo -e "   curl -k https://${CURRENT_IP}/api/health"
echo -e "   curl -k https://${CURRENT_IP}/api/check_connection"
