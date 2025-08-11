#!/bin/bash

# Cubot Production Setup Script for Raspberry Pi
# This script automates the complete deployment process

set -e  # Exit on any error

echo "🚀 Starting Cubot Production Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/Users/thisaruramanayake/Desktop/hardware project2/web app on raspberry pi"
BACKEND_PORT=5001
FRONTEND_PORT=5173
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# Get Raspberry Pi IP
PI_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}Raspberry Pi IP: $PI_IP${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root for nginx setup
if [[ $EUID -eq 0 ]]; then
   print_warning "Running as root - some operations may require sudo"
fi

# Navigate to project directory
cd "$PROJECT_DIR"

# 1. System Updates and Dependencies
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

print_status "Installing system dependencies..."
sudo apt install -y python3-pip python3-venv nginx openssl nodejs npm

# 2. Python Environment Setup
print_status "Setting up Python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies
print_status "Installing Python dependencies..."
pip install -r requirements.txt 2>/dev/null || {
    print_warning "requirements.txt not found, installing common packages..."
    pip install flask flask-cors pyserial python-dotenv
}

# 3. Database Setup
print_status "Setting up database..."
python3 -c "
import os
from app import db, create_app
app = create_app()
with app.app_context():
    db.create_all()
    print('Database initialized successfully')
" 2>/dev/null || print_warning "Database setup skipped (app.py may need manual configuration)"

# 4. Frontend Setup
print_status "Setting up frontend..."
cd frontend

# Install Node.js dependencies
if [ -f "package.json" ]; then
    print_status "Installing Node.js dependencies..."
    npm install
    
    # Build production version
    print_status "Building frontend for production..."
    npm run build
    
    # Update environment variables
    if [ -f ".env" ]; then
        sed -i "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://$PI_IP/api|g" .env
        print_status "Updated frontend .env with IP: $PI_IP"
    else
        echo "VITE_API_BASE_URL=https://$PI_IP/api" > .env
        print_status "Created frontend .env with IP: $PI_IP"
    fi
else
    print_warning "Frontend directory not found or package.json missing"
fi

cd "$PROJECT_DIR"

# 5. SSL Certificate Generation
print_status "Generating SSL certificates..."
if [ ! -f "cert.pem" ] || [ ! -f "key.pem" ]; then
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$PI_IP"
    print_status "SSL certificates generated"
else
    print_status "SSL certificates already exist"
fi

# 6. Nginx Configuration
print_status "Configuring nginx..."
if [ -f "cubot-nginx.conf" ]; then
    # Update nginx config with correct paths
    sed -i "s|/path/to/project|$PROJECT_DIR|g" cubot-nginx.conf
    sed -i "s|localhost|$PI_IP|g" cubot-nginx.conf
    
    # Copy nginx configuration
    sudo cp cubot-nginx.conf "$NGINX_AVAILABLE/cubot"
    sudo ln -sf "$NGINX_AVAILABLE/cubot" "$NGINX_ENABLED/cubot"
    
    # Test nginx configuration
    sudo nginx -t && print_status "Nginx configuration valid" || print_error "Nginx configuration test failed"
    
    # Restart nginx
    sudo systemctl restart nginx
    print_status "Nginx restarted"
else
    print_warning "cubot-nginx.conf not found, nginx setup skipped"
fi

# 7. Firewall Configuration
print_status "Configuring firewall..."
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5001/tcp
print_status "Firewall configured for web traffic"

# 8. Service Files Creation
print_status "Creating systemd service files..."

# Backend service
cat > cubot-backend.service << EOF
[Unit]
Description=Cubot Flask Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=$PROJECT_DIR
Environment=PATH=$PROJECT_DIR/venv/bin
ExecStart=$PROJECT_DIR/venv/bin/python3 app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo cp cubot-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cubot-backend.service

# 9. Testing
print_status "Testing installation..."

# Test backend
if curl -s http://localhost:$BACKEND_PORT/api/system-status > /dev/null; then
    print_status "✅ Backend is running"
else
    print_error "❌ Backend test failed"
fi

# Test nginx
if curl -s http://localhost/api/system-status > /dev/null; then
    print_status "✅ Nginx proxy is working"
else
    print_warning "⚠️  Nginx proxy test failed (may need manual configuration)"
fi

# 10. Final Instructions
print_status "🎉 Setup complete!"
echo ""
echo -e "${GREEN}Access URLs:${NC}"
echo "  • HTTP:  http://$PI_IP"
echo "  • HTTPS: https://$PI_IP"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Connect ESP32 via USB"
echo "  2. Test camera access on mobile browser"
echo "  3. Accept SSL certificate warning"
echo "  4. Test cube scanning functionality"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  • ESP32 must be connected before testing"
echo "  • Mobile browsers require HTTPS for camera"
echo "  • Accept certificate warnings on mobile"
echo ""
echo -e "${GREEN}Services:${NC}"
echo "  • Backend: sudo systemctl start cubot-backend"
echo "  • Nginx: sudo systemctl restart nginx"
echo "  • Logs: sudo journalctl -u cubot-backend -f"

# Create quick start script
cat > start-cubot.sh << EOF
#!/bin/bash
echo "Starting Cubot services..."
sudo systemctl start cubot-backend
sudo systemctl restart nginx
echo "Services started. Access at https://$PI_IP"
EOF

chmod +x start-cubot.sh

print_status "Quick start script created: ./start-cubot.sh"

# Save configuration
echo "# Cubot Configuration" > cubot-config.txt
echo "PI_IP=$PI_IP" >> cubot-config.txt
echo "BACKEND_PORT=$BACKEND_PORT" >> cubot-config.txt
echo "PROJECT_DIR=$PROJECT_DIR" >> cubot-config.txt
echo "Configuration saved to cubot-config.txt"

echo ""
echo -e "${GREEN}🚀 Production setup complete!${NC}"
echo "Run './start-cubot.sh' to start services"
