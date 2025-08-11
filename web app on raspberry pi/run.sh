#!/bin/bash

# Flask Backend Startup Script
echo "Starting CUBOT Flask Backend..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Set environment variables
export FLASK_APP=app.py
export FLASK_ENV=development
export SECRET_KEY=${SECRET_KEY:-"your-secret-key-change-in-production"}
export DATABASE_URL=${DATABASE_URL:-"sqlite:///cubot.db"}

# Run Flask application
echo "Starting Flask server on http://localhost:5000"
python app.py
