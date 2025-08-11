#!/bin/bash

echo "🔐 Setting up nginx with SSL for camera access..."

# Create SSL directory
sudo mkdir -p /etc/nginx/ssl
sudo mkdir -p /usr/local/var/log/nginx

# Generate self-signed SSL certificate
echo "📜 Generating self-signed SSL certificate..."
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/cubot.key \
    -out /etc/nginx/ssl/cubot.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=172.20.10.5"

# Set proper permissions
sudo chmod 600 /etc/nginx/ssl/cubot.key
sudo chmod 644 /etc/nginx/ssl/cubot.crt

# Build React app for production
echo "📦 Building React app..."
cd "/Users/thisaruramanayake/Desktop/hardware project2/web app on raspberry pi"
npm run build

# Update .env for HTTPS
echo "🔧 Updating .env for HTTPS..."
sed -i '' 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://172.20.10.5/api|' .env

# Rebuild with new API URL
npm run build

# Copy nginx configuration
echo "📋 Setting up nginx configuration..."
sudo cp cubot-nginx-https.conf /etc/nginx/sites-available/cubot-https

# Enable the HTTPS site
sudo ln -sf /etc/nginx/sites-available/cubot-https /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/cubot

# Test nginx configuration
echo "✅ Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "🔄 Restarting nginx..."
    sudo nginx -s reload || sudo systemctl restart nginx
    
    echo ""
    echo "✅ HTTPS setup complete!"
    echo "🌐 Your web app is now accessible at:"
    echo "   https://172.20.10.5"
    echo ""
    echo "📱 Camera access should now work on mobile devices!"
    echo "⚠️  You may see a security warning - click 'Advanced' and 'Proceed' to continue"
    echo ""
    echo "🚀 Make sure Flask backend is running:"
    echo "   python3 -m flask run --host=0.0.0.0 --port=5002"
else
    echo "❌ Nginx configuration test failed. Please check the configuration."
    exit 1
fi
