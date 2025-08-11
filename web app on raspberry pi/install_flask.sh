#!/bin/bash

# Install Python dependencies
pip install -r requirements.txt

# Create database
python -c "from app import app, db; app.app_context().push(); db.create_all(); print('Database created successfully')"

echo "Flask backend setup complete!"
echo "To run the backend: python run_flask.py"
echo "To run the frontend: npm run dev:frontend"
