#!/bin/bash

echo "🚀 Setting up nginx for Cubot Web App..."

# Navigate to project directory
cd "/home/pi/Desktop/Cubot Web 3/Cubot Web 3"

echo "📦 Building React app for production..."
npm run build

echo "🔧 Copying nginx configuration..."
sudo cp cubot-nginx.conf /etc/nginx/sites-available/cubot

echo "🔗 Enabling the site..."
sudo ln -sf /etc/nginx/sites-available/cubot /etc/nginx/sites-enabled/

echo "🗑️ Removing default nginx site..."
sudo rm -f /etc/nginx/sites-enabled/default

echo "✅ Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "🔄 Restarting nginx..."
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    echo "🌐 Starting Flask backend..."
    echo "Run this command in a separate terminal:"
    echo "cd '/home/pi/Desktop/Cubot Web 3/Cubot Web 3' && python3 -m flask run --host=0.0.0.0 --port=5001"
    
    echo ""
    echo "✅ Setup complete!"
    echo "🌐 Your web app should now be accessible at:"
    echo "   http://172.20.10.4"
    echo "   http://localhost"
    echo "   http://raspberrypi.local"
    echo ""
    echo "📱 You can now access it from your phone using: http://172.20.10.4"
else
    echo "❌ Nginx configuration test failed. Please check the configuration."
    exit 1
fi
