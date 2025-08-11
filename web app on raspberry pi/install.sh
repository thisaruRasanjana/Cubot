#!/bin/bash

# CUBOT Installation Script for Raspberry Pi 4
# Run this script to set up the complete CUBOT environment

set -e

echo "========================================="
echo "CUBOT Installation Script"
echo "========================================="

# Update system
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install system dependencies
echo "Installing system dependencies..."
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    nginx \
    ufw

# Create application directory
echo "Setting up application directory..."
APP_DIR="/home/pi/cubot"
if [ ! -d "$APP_DIR" ]; then
    mkdir -p "$APP_DIR"
fi

# Set up Python virtual environment
echo "Creating Python virtual environment..."
cd "$APP_DIR"
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Set up serial permissions
echo "Configuring serial permissions..."
sudo usermod -a -G dialout pi

# Create systemd service
echo "Creating systemd service..."
sudo tee /etc/systemd/system/cubot.service > /dev/null <<EOF
[Unit]
Description=CUBOT Rubik's Cube Robot
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin
ExecStart=$APP_DIR/venv/bin/python app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "Enabling CUBOT service..."
sudo systemctl daemon-reload
sudo systemctl enable cubot.service

# Configure firewall
echo "Configuring firewall..."
sudo ufw allow 5000/tcp
sudo ufw --force enable

# Make scripts executable
chmod +x run.sh

echo "========================================="
echo "Installation completed successfully!"
echo "========================================="
echo ""
echo "To start CUBOT:"
echo "  sudo systemctl start cubot"
echo ""
echo "To run manually:"
echo "  ./run.sh"
echo ""
echo "Access the web interface at:"
echo "  http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "Note: Make sure your ESP32 is connected via USB"
echo "      and appears as /dev/ttyUSB0"
echo ""
