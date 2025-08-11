#!/bin/bash

# Cubot Web App Deployment Script for Raspberry Pi
# Updated for new IP: 192.168.98.145

set -e  # Exit on any error

PI_IP="192.168.98.145"
PI_USER="pi"
PI_PROJECT_PATH="/home/pi/Cubot Web 4/Cubot Web 4"

echo "🚀 Starting Cubot Web App deployment to Pi at $PI_IP..."

# Step 1: Transfer updated files to Pi
echo "📁 Transferring files to Pi..."

# Transfer main application files
scp app.py "$PI_USER@$PI_IP:$PI_PROJECT_PATH/"
scp .env "$PI_USER@$PI_IP:$PI_PROJECT_PATH/"
scp requirements.txt "$PI_USER@$PI_IP:$PI_PROJECT_PATH/"

# Transfer frontend source files
scp -r src/ "$PI_USER@$PI_IP:$PI_PROJECT_PATH/"
scp package.json "$PI_USER@$PI_IP:$PI_PROJECT_PATH/"
scp package-lock.json "$PI_USER@$PI_IP:$PI_PROJECT_PATH/"

echo "✅ Files transferred successfully!"

# Step 2: Execute deployment commands on Pi
echo "🔧 Executing deployment commands on Pi..."

ssh "$PI_USER@$PI_IP" << 'EOF'
    set -e
    
    echo "📍 Navigating to project directory..."
    cd "/home/pi/Cubot Web 4/Cubot Web 4"
    
    echo "🛑 Stopping existing backend process..."
    pkill -f "python3 app.py" || echo "No existing backend process found"
    
    echo "🐍 Activating virtual environment..."
    source venv/bin/activate
    
    echo "📦 Installing/updating Python dependencies..."
    pip install -r requirements.txt
    
    echo "🔨 Building frontend..."
    npm install
    npm run build
    
    echo "📋 Deploying frontend to nginx..."
    sudo rm -rf /var/www/cubot/*
    sudo cp -r dist/* /var/www/cubot/
    
    echo "🌐 Updating nginx configuration..."
    sudo sed -i 's/192\.168\.135\.145/192.168.98.145/g' /etc/nginx/sites-available/cubot-https || echo "Nginx config already updated"
    
    echo "🔄 Restarting nginx..."
    sudo systemctl restart nginx
    
    echo "🚀 Starting backend server..."
    nohup python3 app.py > backend.log 2>&1 &
    
    echo "⏳ Waiting for backend to start..."
    sleep 5
    
    echo "🔍 Checking backend status..."
    if pgrep -f "python3 app.py" > /dev/null; then
        echo "✅ Backend is running!"
    else
        echo "❌ Backend failed to start. Check backend.log"
        tail -10 backend.log
    fi
    
    echo "🔍 Checking nginx status..."
    if sudo systemctl is-active --quiet nginx; then
        echo "✅ Nginx is running!"
    else
        echo "❌ Nginx is not running"
        sudo systemctl status nginx
    fi
    
    echo "🎯 Deployment completed!"
    echo "🌐 Web app should be available at: https://192.168.98.145"
    echo "📊 Backend logs: tail -f backend.log"
EOF

echo "🎉 Deployment script completed!"
echo ""
echo "🌐 Your Cubot web app should now be available at:"
echo "   https://192.168.98.145"
echo ""
echo "📋 Next steps:"
echo "   1. Open https://192.168.98.145 in your browser"
echo "   2. Test ESP32 connection in the app"
echo "   3. Try both Learning Mode and Solving Mode"
echo ""
echo "🔧 If you need to check logs:"
echo "   ssh pi@192.168.98.145"
echo "   cd '/home/pi/Cubot Web 4/Cubot Web 4'"
echo "   tail -f backend.log"
