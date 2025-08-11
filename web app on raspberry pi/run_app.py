#!/usr/bin/env python3
import os
import sys
from app import app, create_tables

if __name__ == '__main__':
    # Create database tables
    create_tables()
    
    # Run the Flask app
    print("Starting Flask server on http://localhost:5000")
    print("Make sure to run 'npm run dev' in another terminal for the React frontend")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
