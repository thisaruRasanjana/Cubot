#!/bin/bash

# Fix Node.js dependency conflicts on Raspberry Pi
echo "🔧 Fixing Node.js dependency conflicts..."

# Remove conflicting packages
echo "Removing conflicting Node.js packages..."
sudo apt remove --purge nodejs npm -y
sudo apt autoremove -y
sudo apt autoclean

# Clean package cache
echo "Cleaning package cache..."
sudo apt clean
sudo dpkg --configure -a

# Update package lists
echo "Updating package lists..."
sudo apt update

# Install Node.js using NodeSource repository (recommended for Pi)
echo "Installing Node.js from NodeSource..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
echo "Verifying Node.js installation..."
node --version
npm --version

echo "✅ Node.js fix complete!"
