# Cubot Web App - Raspberry Pi Production Deployment Guide

## Overview
This guide provides complete instructions for deploying the Cubot web app on a Raspberry Pi with HTTPS support for mobile camera access.

## System Requirements
- Raspberry Pi 3B+ or newer
- Raspberry Pi OS (64-bit recommended)
- Internet connection
- ESP32 connected via USB
- Domain name (optional, for trusted SSL)

## Architecture
- **Frontend**: React app served via nginx/Python HTTPS server
- **Backend**: Flask API on port 5001/5002
- **Hardware**: ESP32 serial communication
- **Security**: HTTPS required for mobile camera access

## Quick Start (Automated)

### 1. Initial Setup
```bash
# Clone and navigate to project
cd /Users/thisaruramanayake/Desktop/hardware\ project2/web\ app\ on\ raspberry\ pi/

# Run automated setup
chmod +x setup-production.sh
./setup-production.sh
```

### 2. Manual Steps
```bash
# Start backend
python3 app.py &

# Start frontend (choose one method)
# Method 1: Nginx (production)
sudo ./setup-nginx.sh

# Method 2: Python HTTPS server (development/testing)
python3 https-server.py

# Test ESP32 connection
curl http://localhost:5001/api/system-status
```

## Detailed Setup Instructions

### Backend Setup
1. **Environment Configuration**
   ```bash
   # Edit .env file
   nano .env
   
   # Required variables:
   FLASK_PORT=5001
   VITE_API_BASE_URL=https://YOUR_PI_IP/api
   SECRET_KEY=your-secret-key
   DATABASE_URL=sqlite:///cubot.db
   ```

2. **Install Dependencies**
   ```bash
   pip3 install -r requirements.txt
   pip3 install flask-cors pyserial
   ```

3. **Database Initialization**
   ```bash
   python3 -c "from app import db; db.create_all()"
   ```

4. **Start Backend**
   ```bash
   python3 app.py
   ```

### Frontend Setup

#### Option A: Nginx (Production)
1. **Build React App**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Setup Nginx**
   ```bash
   sudo cp cubot-nginx.conf /etc/nginx/sites-available/cubot
   sudo ln -sf /etc/nginx/sites-available/cubot /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

3. **SSL Certificates**
   ```bash
   # Generate self-signed certificates
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   
   # Place in nginx directory
   sudo cp cert.pem /etc/ssl/certs/cubot.crt
   sudo cp key.pem /etc/ssl/private/cubot.key
   ```

#### Option B: Python HTTPS Server (Development)
1. **Generate SSL Certificates**
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

2. **Start HTTPS Server**
   ```bash
   python3 https-server.py
   ```

### ESP32 Connection
1. **Check Serial Ports**
   ```bash
   ls /dev/tty*
   dmesg | grep tty
   ```

2. **Test Connection**
   ```bash
   curl http://localhost:5001/api/check_serial_connection
   ```

### Mobile Camera Access
1. **Connect to Pi**
   - Find Pi IP: `hostname -I`
   - Use HTTPS URL: `https://YOUR_PI_IP`

2. **Accept Certificate**
   - Browser will show security warning
   - Click "Advanced" → "Proceed to site"

3. **Grant Permissions**
   - Allow camera access when prompted
   - Test on both iOS Safari and Android Chrome

## Troubleshooting

### Common Issues

#### Backend Not Starting
```bash
# Check port availability
sudo lsof -i :5001

# Check logs
tail -f app.log
```

#### Frontend Shows "Disconnected"
```bash
# Test backend connectivity
curl http://localhost:5001/api/system-status

# Check ESP32 connection
curl http://localhost:5001/api/check_serial_connection
```

#### Camera Not Working
```bash
# Verify HTTPS
openssl s_client -connect YOUR_PI_IP:443

# Check browser console for errors
# Ensure HTTPS URL is used (not HTTP)
```

#### Nginx 502 Bad Gateway
```bash
# Check backend is running
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### File Permissions
```bash
# Fix nginx permissions
sudo chown -R www-data:www-data /var/www/cubot
sudo chmod -R 755 /var/www/cubot
```

## Environment Variables Reference

### Backend (.env)
```bash
FLASK_PORT=5001
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///cubot.db
FLASK_ENV=production
FLASK_DEBUG=False
```

### Frontend (.env)
```bash
VITE_API_BASE_URL=https://YOUR_PI_IP/api
```

## Automated Scripts

### setup-production.sh
Comprehensive setup script that:
- Installs all dependencies
- Sets up SSL certificates
- Configures nginx
- Starts backend services
- Builds frontend

### https-server.py
Python HTTPS server for:
- Development testing
- Quick deployment verification
- Camera access testing

## Monitoring and Logs

### Backend Logs
```bash
tail -f app.log
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### System Logs
```bash
sudo journalctl -u nginx -f
```

## Security Notes
- Self-signed certificates are used for local development
- For production domains, use Let's Encrypt certificates
- Change default passwords and secret keys
- Consider firewall configuration for external access

## Performance Optimization
- Use production builds for React
- Enable gzip compression in nginx
- Consider using PM2 for process management
- Monitor system resources with `htop`

## Backup and Recovery
```bash
# Backup database
cp cubot.db cubot.db.backup

# Backup configuration
cp .env .env.backup
cp cubot-nginx.conf cubot-nginx.conf.backup
```

## Next Steps
1. Test full deployment workflow
2. Document any edge cases
3. Create monitoring dashboard
4. Add automated testing scripts
5. Consider Docker containerization
