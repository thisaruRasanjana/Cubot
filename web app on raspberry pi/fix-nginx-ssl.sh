#!/bin/bash

# Fix nginx SSL configuration for paths with spaces
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PI_IP=$(hostname -I | awk '{print $1}')
PROJECT_DIR="/home/pi/Desktop/Cubot Web 4/Cubot Web 4"

echo -e "${GREEN}🔧 Fixing nginx SSL configuration...${NC}"

cd "$PROJECT_DIR"

# Create nginx HTTPS configuration with proper path escaping
echo -e "${YELLOW}Creating corrected nginx HTTPS configuration...${NC}"
cat > cubot-nginx-https.conf << 'EOF'
server {
    listen 80;
    server_name _;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/cubot.crt;
    ssl_certificate_key /etc/ssl/private/cubot.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Permissions-Policy "camera=*, microphone=*" always;

    # Root directory - copy files to avoid spaces in path
    root /var/www/cubot;
    index index.html;

    # Handle React routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # API proxy to Flask backend
    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }

    # Logging
    access_log /var/log/nginx/cubot_access.log;
    error_log /var/log/nginx/cubot_error.log;
}
EOF

# Create web directory without spaces
echo -e "${YELLOW}Creating web directory...${NC}"
sudo mkdir -p /var/www/cubot

# Copy frontend build to web directory (if it exists)
if [ -d "frontend/dist" ]; then
    echo -e "${YELLOW}Copying frontend files...${NC}"
    sudo cp -r frontend/dist/* /var/www/cubot/
else
    echo -e "${YELLOW}Creating basic index.html (frontend not built yet)...${NC}"
    sudo tee /var/www/cubot/index.html > /dev/null << 'HTML'
<!DOCTYPE html>
<html>
<head>
    <title>Cubot Web App</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <h1>Cubot Web App</h1>
    <p>Backend is running. Frontend build needed.</p>
    <p>API Status: <span id="status">Checking...</span></p>
    
    <script>
        fetch('/api/system-status')
            .then(response => response.json())
            .then(data => {
                document.getElementById('status').textContent = 'Connected';
            })
            .catch(error => {
                document.getElementById('status').textContent = 'Error: ' + error;
            });
    </script>
</body>
</html>
HTML
fi

# Set proper permissions
sudo chown -R www-data:www-data /var/www/cubot
sudo chmod -R 755 /var/www/cubot

# Install nginx configuration
sudo cp cubot-nginx-https.conf /etc/nginx/sites-available/cubot
sudo ln -sf /etc/nginx/sites-available/cubot /etc/nginx/sites-enabled/cubot

# Remove default nginx site
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
sudo nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx configuration valid${NC}"
    
    # Reload nginx
    echo -e "${YELLOW}Reloading nginx...${NC}"
    sudo systemctl reload nginx
    
    # Test HTTPS
    echo -e "${YELLOW}Testing HTTPS...${NC}"
    sleep 2
    
    if curl -k -s https://localhost/ > /dev/null; then
        echo -e "${GREEN}✅ HTTPS working!${NC}"
    else
        echo -e "${RED}❌ HTTPS test failed${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 SSL setup complete!${NC}"
    echo ""
    echo "Access URLs:"
    echo "  • HTTP:  http://$PI_IP (redirects to HTTPS)"
    echo "  • HTTPS: https://$PI_IP"
    echo ""
    echo "API Test:"
    echo "  curl -k https://$PI_IP/api/system-status"
    echo ""
    echo "Mobile Access:"
    echo "  1. Navigate to: https://$PI_IP"
    echo "  2. Accept certificate warning"
    echo "  3. Allow camera access"
    
else
    echo -e "${RED}❌ Nginx configuration test failed${NC}"
    echo "Check the logs: sudo tail -f /var/log/nginx/error.log"
fi
EOF
