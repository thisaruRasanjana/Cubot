#!/usr/bin/env python3
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set default environment variables if not set
if not os.environ.get('SECRET_KEY'):
    os.environ['SECRET_KEY'] = 'dev-secret-key-change-in-production'

if not os.environ.get('DATABASE_URL'):
    os.environ['DATABASE_URL'] = 'sqlite:///cubot.db'

# Import and run the app
from app import app, create_tables

if __name__ == '__main__':
    # Create database tables
    create_tables()
    
    # Get port from environment variable or default to 5001
    port = int(os.environ.get('FLASK_PORT', 5001))
    
    print(f"Starting Flask server on http://localhost:{port}")
    print("Frontend will be available on http://localhost:5173")
    print("Run 'npm run dev' in another terminal for the React frontend")
    print("To change port, set FLASK_PORT environment variable")
    
    app.run(debug=True, host='0.0.0.0', port=port)
