from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import subprocess
import glob
import sys
import os
import jwt
# Diagnostic functions moved inline to avoid import issues
import base64
import serial
import time
import logging
import uuid
import sys
from pathlib import Path
import threading
import queue
from typing import Optional, Dict, Any
import serial.tools.list_ports
import glob

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///cubot.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# File upload configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Enable CORS with specific origins and settings
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.135.145",
    "http://192.168.135.145:5173",
    "https://192.168.135.145",
    "https://192.168.135.145:5173",
    "http://172.20.10.4",
    "http://172.20.10.4:5173",
    "https://172.20.10.4",
    "https://172.20.10.4:5173",
    "http://172.20.10.5",
    "http://172.20.10.5:5173",
    "https://172.20.10.5",
    "https://172.20.10.5:5173",
    "http://raspberrypi.local:5173",
    "http://raspberrypi.local:5001",
    "http://raspberrypi:5173",
    "http://raspberrypi:5001"
]

# Enable CORS with specific origins
cors = CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "expose_headers": ["Content-Disposition"]
    }
})

db = SQLAlchemy(app)

# Global system status dictionary
system_status = {
    'esp32_connected': False,
    'last_esp32_check': None,
    'connection_manager_running': False
}

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    public_id = db.Column(db.String(50), unique=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin = db.Column(db.Boolean, default=False)
    last_login = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'public_id': self.public_id,
            'name': self.name,
            'email': self.email,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class SolvingSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    cube_state = db.Column(db.Text, nullable=False, default='')
    moves = db.Column(db.JSON, default=list)
    current_step = db.Column(db.Integer, default=0)
    total_steps = db.Column(db.Integer, default=0)
    elapsed_time = db.Column(db.Integer, default=0)
    progress_percent = db.Column(db.Float, default=0.0)
    is_active = db.Column(db.Boolean, default=True)
    status = db.Column(db.String(20), default='solving')
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)

class CubeImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    session_id = db.Column(db.Integer, db.ForeignKey('solving_session.id'), nullable=True)
    face = db.Column(db.String(10), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    processed = db.Column(db.Boolean, default=False)
    face_colors = db.Column(db.Text, nullable=True)

class LearningProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    current_step = db.Column(db.String(20), default='cross')
    step_index = db.Column(db.Integer, default=0)
    completed_steps = db.Column(db.JSON, default=list)
    practice_count = db.Column(db.Integer, default=0)

class SystemStatus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    serial_connected = db.Column(db.Boolean, default=False)
    current_mode = db.Column(db.String(20), default='solving')
    last_update = db.Column(db.DateTime, default=datetime.utcnow)
    esp32_status = db.Column(db.String(100), nullable=True)

# Helper functions
def find_esp32_port():
    """
    Find and return the first available ESP32 serial port.
    Returns:
        str: The port name if found, None otherwise
    """
    import serial.tools.list_ports
    import glob
    import os
    
    # Method 1: Try common USB-to-UART chips
    try:
        ports = serial.tools.list_ports.comports()
        for port in ports:
            port_info = str(port).lower()
            if any(x in port_info for x in ['ch340', 'cp210', 'ftdi', 'usb', 'acm']):
                try:
                    # Just check if port exists and is accessible (no ping interference)
                    app.logger.debug(f"Found potential ESP32 port: {port.device}")
                    # Test if we can open the port without sending commands
                    with serial.Serial(port.device, 115200, timeout=0.1) as ser:
                        app.logger.info(f"Port {port.device} is accessible")
                        return port.device
                except Exception as e:
                    app.logger.warning(f"Error testing {port.device}: {e}")
                    continue
    except Exception as e:
        app.logger.error(f"Error scanning serial ports: {e}")
    
    # Method 2: Try common port patterns
    common_ports = ['/dev/ttyUSB*', '/dev/ttyACM*']
    if sys.platform.startswith('win'):
        common_ports = ['COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10']
    elif sys.platform.startswith('darwin'):  # macOS
        common_ports = ['/dev/tty.usbserial*', '/dev/tty.usbmodem*', '/dev/cu.*']
    
    for pattern in common_ports:
        try:
            for port in glob.glob(pattern):
                try:
                    if not os.path.exists(port) or not os.path.isfile(port):
                        continue
                        
                    app.logger.info(f"Trying port: {port}")
                    ser = serial.Serial(port, 115200, timeout=1)
                    ser.write(b'ping\n')
                    time.sleep(0.5)  # Increased delay for response
                    response = ser.read(100)  # Read up to 100 bytes
                    ser.close()
                    
                    if response:  # If we get any response, consider it valid
                        app.logger.info(f"Found responding device at {port}")
                        return port
                except (OSError, serial.SerialException) as e:
                    app.logger.debug(f"Port {port} not available: {e}")
                    continue
        except Exception as e:
            app.logger.error(f"Error scanning port pattern {pattern}: {e}")
            continue
    
    app.logger.warning("No responding serial device found")
    return None

def generate_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in headers
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
            
        try:
            # Decode the token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(public_id=data['public_id']).first()
            
            if not current_user:
                return jsonify({'message': 'User not found'}), 401
                
            # Update last login time
            current_user.last_login = datetime.utcnow()
            db.session.commit()
            
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        except Exception as e:
            app.logger.error(f"Token validation error: {str(e)}")
            return jsonify({'message': 'Could not verify token'}), 401
            
        return f(current_user, *args, **kwargs)
        
    return decorated

def get_current_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        token = auth_header.split(' ')[1]  # Bearer <token>
        user_id = verify_token(token)
        if user_id:
            return User.query.get(user_id)
    except:
        pass
    return None

# ═══════════════════════════════════════════════════════════════════════════════
# PERSISTENT ESP32 CONNECTION MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class ESP32ConnectionManager:
    """Singleton class to manage persistent ESP32 serial connection with command queue."""
    
    _instance = None
    _lock = threading.Lock()
    
    
    def __init__(self):
        self.initialized = True
        self.serial_connection: Optional[serial.Serial] = None
        self.command_queue = queue.Queue()
        self.response_queue = queue.Queue()
        self.connection_lock = threading.Lock()
        self.worker_thread = None
        self.is_running = False
        
        # Smart connection tracking
        self.confirmed_esp32_port = None  # Port confirmed to be ESP32
        self.esp32_confirmed = False      # Whether we've confirmed it's an ESP32
        self.last_port_check = 0          # Last time we checked port availability
        self.port_check_interval = 5      # Check port availability every 5 seconds
        self.connection_status = {'connected': False, 'port': None, 'last_check': None}
        
        logger.info("ESP32ConnectionManager initialized with smart detection")
    
    def check_esp32_connection_smart(self):
        """Smart ESP32 connection check - only ping once, then monitor port presence."""
        current_time = time.time()
        
        # Step 1: Find available ports
        available_port = find_esp32_port()
        
        if not available_port:
            # No ESP32-like ports found
            logger.info("[SMART] No ESP32 ports detected")
            self.esp32_confirmed = False
            self.confirmed_esp32_port = None
            self.connection_status = {
                'connected': False,
                'port': None,
                'last_check': current_time,
                'method': 'port_detection',
                'status': 'no_ports_found'
            }
            return False
        
        # Step 2: Check if this is a new port or we need to confirm ESP32
        if not self.esp32_confirmed or self.confirmed_esp32_port != available_port:
            logger.info(f"[SMART] New/unconfirmed port detected: {available_port} - sending single ping")
            
            # Send ONE ping to confirm it's an ESP32
            try:
                with serial.Serial(available_port, 115200, timeout=2) as ser:
                    ser.reset_input_buffer()
                    ser.reset_output_buffer()
                    
                    # Send single ping
                    ser.write(b'PING\n')
                    time.sleep(0.5)
                    
                    # Read response
                    response = ser.read(100).decode('utf-8', errors='ignore').strip()
                    
                    if 'PONG' in response:
                        # Confirmed ESP32!
                        logger.info(f"[SMART] ✅ ESP32 confirmed at {available_port} - will not ping again")
                        self.esp32_confirmed = True
                        self.confirmed_esp32_port = available_port
                        self.connection_status = {
                            'connected': True,
                            'port': available_port,
                            'last_check': current_time,
                            'method': 'ping_confirmation',
                            'status': 'esp32_confirmed'
                        }
                        return True
                    else:
                        # Not an ESP32
                        logger.warning(f"[SMART] ❌ Port {available_port} did not respond with PONG: {response}")
                        self.esp32_confirmed = False
                        self.confirmed_esp32_port = None
                        self.connection_status = {
                            'connected': False,
                            'port': available_port,
                            'last_check': current_time,
                            'method': 'ping_confirmation',
                            'status': 'not_esp32'
                        }
                        return False
                        
            except Exception as e:
                logger.error(f"[SMART] ❌ Failed to ping {available_port}: {e}")
                self.esp32_confirmed = False
                self.confirmed_esp32_port = None
                self.connection_status = {
                    'connected': False,
                    'port': available_port,
                    'last_check': current_time,
                    'method': 'ping_confirmation',
                    'status': 'ping_failed',
                    'error': str(e)
                }
                return False
        
        # Step 3: ESP32 already confirmed - just check if port still exists
        elif self.esp32_confirmed and self.confirmed_esp32_port == available_port:
            # Port still exists and was previously confirmed as ESP32
            logger.debug(f"[SMART] ✅ ESP32 still connected at {available_port} (no ping needed)")
            self.connection_status = {
                'connected': True,
                'port': available_port,
                'last_check': current_time,
                'method': 'port_monitoring',
                'status': 'confirmed_port_present'
            }
            return True
        
        # Step 4: Previously confirmed port is no longer available
        else:
            logger.warning(f"[SMART] ❌ Previously confirmed ESP32 port {self.confirmed_esp32_port} is no longer available")
            self.esp32_confirmed = False
            self.confirmed_esp32_port = None
            self.connection_status = {
                'connected': False,
                'port': self.confirmed_esp32_port,
                'last_check': current_time,
                'method': 'port_monitoring',
                'status': 'confirmed_port_lost'
            }
            return False
    
    def start(self):
        """Start the connection manager and worker thread."""
        with self.connection_lock:
            if self.is_running:
                return True
            
            if self._establish_connection():
                self.is_running = True
                self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
                self.worker_thread.start()
                logger.info("✅ ESP32ConnectionManager started successfully")
                return True
            else:
                logger.error("❌ Failed to start ESP32ConnectionManager - no connection")
                return False
    
    def stop(self):
        """Stop the connection manager and close connection."""
        with self.connection_lock:
            self.is_running = False
            if self.serial_connection and self.serial_connection.is_open:
                self.serial_connection.close()
                logger.info("ESP32 serial connection closed")
            self.connection_status['connected'] = False
    
    def _establish_connection(self) -> bool:
        """Establish persistent serial connection to ESP32."""
        port = find_esp32_port()
        if not port:
            logger.warning("No ESP32 device found")
            return False
        
        try:
            self.serial_connection = serial.Serial(port, 115200, timeout=1)
            self.serial_connection.reset_input_buffer()
            self.serial_connection.reset_output_buffer()
            
            # Test connection with PING
            if self._send_ping():
                self.connection_status = {
                    'connected': True,
                    'port': port,
                    'last_check': time.time()
                }
                logger.info(f"✅ Persistent ESP32 connection established on {port}")
                return True
            else:
                self.serial_connection.close()
                logger.error(f"❌ ESP32 not responding on {port}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to establish ESP32 connection: {e}")
            return False
    
    def _send_ping(self) -> bool:
        """Send PING and wait for PONG response."""
        try:
            self.serial_connection.write(b'PING\n')
            self.serial_connection.flush()
            
            # Wait for PONG response
            start_time = time.time()
            while time.time() - start_time < 2:
                if self.serial_connection.in_waiting > 0:
                    response = self.serial_connection.readline().decode('utf-8', errors='ignore').strip()
                    if response == 'PONG':
                        self.last_heartbeat = time.time()
                        return True
                time.sleep(0.1)
            return False
        except Exception as e:
            logger.error(f"PING failed: {e}")
            return False
    
    def _worker_loop(self):
        """Main worker thread loop for processing commands and heartbeat."""
        logger.info("ESP32 worker thread started")
        last_heartbeat_check = time.time()
        
        while self.is_running:
            try:
                # Process pending commands with timeout to prevent blocking
                try:
                    command_data = self.command_queue.get(timeout=1)
                    # Execute command - use direct execution for move commands to ensure completion detection
                    command = command_data.get('command', '')
                    if len(command) > 10:  # Likely a move sequence - execute directly for completion detection
                        self._execute_command_safe(command_data)
                    else:
                        # For short commands (PING, RELEASE, GRIP), use threading to prevent blocking
                        import threading
                        command_thread = threading.Thread(
                            target=self._execute_command_safe, 
                            args=(command_data,)
                        )
                        command_thread.daemon = True
                        command_thread.start()
                except queue.Empty:
                    pass
                
                # Skip heartbeat - using smart detection instead for connection status
                # This prevents ping interference with user commands
                
            except Exception as e:
                logger.error(f"Error in ESP32 worker loop: {e}")
                time.sleep(1)
        
        logger.info("ESP32 worker thread stopped")
    
    def _execute_command_safe(self, command_data: Dict[str, Any]):
        """Safe wrapper for command execution that handles exceptions."""
        try:
            self._execute_command(command_data)
        except Exception as e:
            logger.error(f"❌ Command execution failed safely: {e}")
            # Still send response to prevent hanging
            response_queue = command_data.get('response_queue')
            if response_queue:
                response_queue.put({
                    'success': False,
                    'error': str(e),
                    'command': command_data.get('command', 'unknown')
                })
    
    def _execute_command(self, command_data: Dict[str, Any]):
        """Execute a command on the ESP32."""
        command = command_data['command']
        response_queue = command_data.get('response_queue')
        
        try:
            # Quick connection check without delays
            if not self.serial_connection or not self.serial_connection.is_open:
                # Try to quickly re-establish connection
                port = self._find_esp32_port()
                if port:
                    try:
                        self.serial_connection = serial.Serial(port, 115200, timeout=1)
                        logger.info(f"[ESP32] Quick reconnection to {port}")
                    except:
                        raise Exception("No active ESP32 connection")
                else:
                    raise Exception("No active ESP32 connection")
            
            logger.info(f"[ESP32] Executing command: {command}")
            logger.info(f"Sending command to ESP32: {command}")
            logger.info(f"Command length: {len(command)} characters")
            if len(command) > 10:  # Likely a move sequence
                logger.info(f"Move sequence detected: {command[:50]}{'...' if len(command) > 50 else ''}")
            self.serial_connection.write(f"{command}\n".encode())
            self.serial_connection.flush()
            
            # Wait for response based on command type
            if command == 'PING':
                timeout = 2
                expected_response = 'PONG'
            elif command == 'RELEASE':
                timeout = 3  # Reduced from 5 seconds
                expected_response = 'RELEASED'
            elif command == 'GRIP':
                timeout = 8  # GRIP takes longer but not 30 seconds
                expected_response = 'done'
            else:
                # Move commands - generous timeout for worst case scenarios
                timeout = 300  # 5 minutes - handles even very complex solves
                expected_response = 'Done all'
            
            # Wait for response
            start_time = time.time()
            response = None
            completion_received = False
            
            while time.time() - start_time < timeout:
                if self.serial_connection.in_waiting > 0:
                    line = self.serial_connection.readline().decode('utf-8', errors='ignore').strip()
                    logger.info(f"[ESP32] Response: {line}")
                    
                    # For move commands, look for any completion indicator
                    if command not in ['PING', 'RELEASE', 'GRIP']:
                        # More robust completion detection
                        if line == 'Done all':
                            completion_received = True
                            logger.info("[ESP32] Move execution completed")
                        elif line == 'over':
                            # Accept "over" even without "Done all" for robustness
                            response = 'over'
                            logger.info("[ESP32] Move sequence completed (over received)")
                            break
                        elif line == 'Done all' and not completion_received:
                            # If we only get "Done all", accept it as completion
                            response = 'Done all'
                            logger.info("[ESP32] Move sequence completed (Done all only)")
                            break
                    else:
                        # For other commands, use original logic
                        if line in [expected_response, 'done', 'RELEASED', 'PONG']:
                            response = line
                            break
                time.sleep(0.1)
            
            # Send response back if requested
            if response_queue:
                result = {
                    'success': response is not None,
                    'response': response,
                    'command': command
                }
                response_queue.put(result)
            
            if response:
                logger.info(f"✅ Command '{command}' completed successfully")
            else:
                logger.warning(f"⚠️ Command '{command}' timed out")
                
        except Exception as e:
            logger.error(f"❌ Failed to execute command '{command}': {e}")
            if response_queue:
                response_queue.put({
                    'success': False,
                    'error': str(e),
                    'command': command
                })
    
    def send_command(self, command: str, wait_for_response: bool = True) -> Dict[str, Any]:
        """Send a command to ESP32 and optionally wait for response."""
        if not self.is_running:
            return {'success': False, 'error': 'Connection manager not running'}
        
        response_queue_obj = queue.Queue() if wait_for_response else None
        
        command_data = {
            'command': command,
            'response_queue': response_queue_obj
        }
        
        self.command_queue.put(command_data)
        
        if wait_for_response and response_queue_obj:
            try:
                result = response_queue_obj.get(timeout=310)  # Slightly longer than command timeout (5+ minutes)
                return result
            except queue.Empty:
                return {'success': False, 'error': 'Command response timeout'}
        else:
            return {'success': True, 'message': 'Command queued'}
    
    def get_connection_status(self) -> Dict[str, Any]:
        """Get current connection status."""
        return self.connection_status.copy()
    
    def is_connected(self) -> bool:
        """Check if ESP32 is currently connected."""
        return self.connection_status.get('connected', False)

# Global connection manager instance
esp32_manager = ESP32ConnectionManager()

# ═══════════════════════════════════════════════════════════════════════════════

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def check_all_faces_uploaded():
    """Check if all 6 cube faces have been uploaded"""
    required_faces = ['U', 'R', 'F', 'D', 'L', 'B']  # Cube notation
    for face in required_faces:
        face_file = os.path.join(UPLOAD_FOLDER, f'face_{face}.jpg')
        if not os.path.exists(face_file):
            return False
    return True

def process_cube_images():
    """Process all uploaded cube images to generate cube state"""
    try:
        logger.info("Processing cube images...")
        result = subprocess.run(['python3', 'process_cube.py'], 
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            logger.info("Cube processing successful")
            return True
        else:
            logger.error(f"Cube processing failed: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        logger.warning("Cube processing timed out")
        return False
    except Exception as e:
        logger.error(f"Error processing cube: {str(e)}")
        return False

def solve_cube():
    """Generate solution moves from cube state"""
    try:
        logger.info("Generating cube solution...")
        result = subprocess.run(['python3', 'solve_cube.py'], 
                              capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            logger.info("Cube solution generated successfully")
            return True
        else:
            logger.error(f"Cube solving failed: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        logger.warning("Cube solving timed out")
        return False
    except Exception as e:
        logger.error(f"Error solving cube: {str(e)}")
        return False

def clear_previous_moves():
    """Clear any previous solving moves to prevent reusing old solutions"""
    try:
        # Clear all possible solution files that robot might read from
        solution_files = [
            'moves.txt',
            'solution.txt', 
            'cube_solution.txt',
            'solving_moves.txt',
            'robot_moves.txt'
        ]
        
        cleared_files = []
        for file_path in solution_files:
            if os.path.exists(file_path):
                with open(file_path, 'w') as f:
                    f.write('')  # Clear the file
                cleared_files.append(file_path)
        
        if cleared_files:
            logger.info(f"✅ Cleared previous moves from: {', '.join(cleared_files)}")
        else:
            logger.info("ℹ️ No existing solution files found to clear")
            
        return True
    except Exception as e:
        logger.error(f"❌ Error clearing previous moves: {e}")
        return False

def clear_previous_face_images():
    """Clear any previous face images to start fresh scan"""
    try:
        # Clear all face image files from previous scans
        face_files = [
            'face_U.jpg', 'face_R.jpg', 'face_F.jpg',
            'face_D.jpg', 'face_L.jpg', 'face_B.jpg'
        ]
        
        cleared_files = []
        for face_file in face_files:
            file_path = os.path.join(UPLOAD_FOLDER, face_file)
            if os.path.exists(file_path):
                os.remove(file_path)
                cleared_files.append(face_file)
        
        # Also clear cube state file
        if os.path.exists('cube_state.txt'):
            os.remove('cube_state.txt')
            cleared_files.append('cube_state.txt')
            
        if cleared_files:
            logger.info(f"🗑️ Cleared previous face images: {', '.join(cleared_files)}")
        else:
            logger.info("ℹ️ No previous face images found to clear")
            
        return True
    except Exception as e:
        logger.error(f"❌ Error clearing previous face images: {e}")
        return False

def process_cube_images_with_diagnostics():
    """Process cube images with detailed diagnostic information"""
    diagnostics = {
        'timestamp': datetime.utcnow().isoformat(),
        'process': 'image_processing',
        'errors': []
    }
    
    try:
        # Run the actual processing
        result = subprocess.run(['python3', 'process_cube.py'], 
                              capture_output=True, text=True, timeout=30)
        
        diagnostics['return_code'] = result.returncode
        diagnostics['stdout'] = result.stdout
        diagnostics['stderr'] = result.stderr
        
        if result.returncode == 0:
            # Check if output file was created
            if os.path.exists('cube_state.txt'):
                with open('cube_state.txt', 'r') as f:
                    cube_state = f.read().strip()
                    diagnostics['cube_state_length'] = len(cube_state)
                    
                    # Validate cube state format
                    if len(cube_state) != 54:
                        diagnostics['errors'].append(f"Invalid cube state length: {len(cube_state)} (expected 54)")
                        return {'success': False, 'diagnostics': diagnostics}
            else:
                diagnostics['errors'].append("No cube_state.txt file generated")
                return {'success': False, 'diagnostics': diagnostics}
            
            return {'success': True, 'diagnostics': diagnostics}
        else:
            diagnostics['errors'].append(f"Process failed with return code {result.returncode}")
            if result.stderr:
                diagnostics['errors'].append(f"Error output: {result.stderr}")
            return {'success': False, 'diagnostics': diagnostics}
            
    except subprocess.TimeoutExpired:
        diagnostics['errors'].append("Processing timed out after 30 seconds")
        return {'success': False, 'diagnostics': diagnostics}
    except Exception as e:
        diagnostics['errors'].append(f"Unexpected error: {str(e)}")
        return {'success': False, 'diagnostics': diagnostics}

def solve_cube_with_diagnostics():
    """Solve cube with detailed diagnostic information"""
    diagnostics = {
        'timestamp': datetime.utcnow().isoformat(),
        'process': 'cube_solving',
        'errors': []
    }
    
    try:
        # Check if cube_state.txt exists
        if not os.path.exists('cube_state.txt'):
            diagnostics['errors'].append("No cube_state.txt file found - run image processing first")
            return {'success': False, 'diagnostics': diagnostics}
        
        # Run the actual solving
        result = subprocess.run(['python3', 'solve_cube.py'], 
                              capture_output=True, text=True, timeout=60)
        
        diagnostics['return_code'] = result.returncode
        diagnostics['stdout'] = result.stdout
        diagnostics['stderr'] = result.stderr
        
        if result.returncode == 0:
            # Check if moves file was created
            if os.path.exists('moves.txt'):
                with open('moves.txt', 'r') as f:
                    moves = f.read().strip()
                    diagnostics['moves_count'] = len(moves.split()) if moves else 0
                    
                    if not moves:
                        diagnostics['errors'].append("Empty solution generated")
                        return {'success': False, 'diagnostics': diagnostics}
            else:
                diagnostics['errors'].append("No moves.txt file generated")
                return {'success': False, 'diagnostics': diagnostics}
            
            return {'success': True, 'diagnostics': diagnostics}
        else:
            diagnostics['errors'].append(f"Solving failed with return code {result.returncode}")
            if result.stderr:
                diagnostics['errors'].append(f"Error output: {result.stderr}")
            return {'success': False, 'diagnostics': diagnostics}
            
    except subprocess.TimeoutExpired:
        diagnostics['errors'].append("Solving timed out after 60 seconds")
        return {'success': False, 'diagnostics': diagnostics}
    except Exception as e:
        diagnostics['errors'].append(f"Unexpected error: {str(e)}")
        return {'success': False, 'diagnostics': diagnostics}

# Authentication Routes
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validate input
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if user already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already registered'}), 400
    
    try:
        # Create new user
        user = User(
            name=data['name'],
            email=data['email'],
            is_admin=data.get('is_admin', False)
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Generate token
        token = jwt.encode({
            'public_id': user.public_id,
            'exp': datetime.utcnow() + timedelta(days=30)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Registration error: {str(e)}")
        return jsonify({'message': 'Failed to register user'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    auth = request.get_json()
    
    if not auth or not auth.get('email') or not auth.get('password'):
        return jsonify({'message': 'Email and password are required'}), 400
    
    user = User.query.filter_by(email=auth['email']).first()
    
    if not user or not user.check_password(auth['password']):
        return jsonify({'message': 'Invalid email or password'}), 401
    
    # Update last login time
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    # Generate token (valid for 30 days)
    token = jwt.encode({
        'public_id': user.public_id,
        'exp': datetime.utcnow() + timedelta(days=30)
    }, app.config['SECRET_KEY'])
    
    return jsonify({
        'token': token,
        'user': user.to_dict()
    })

# Public Routes - No Authentication Required
@app.route('/api/system-status', methods=['GET'])
def get_system_status():
    try:
        # Get or create system status
        status = SystemStatus.query.first()
        if not status:
            status = SystemStatus()
            db.session.add(status)
        
        # Check connection status using smart detection (no ping interference)
        try:
            # Use smart detection that doesn't interfere with commands
            status.serial_connected = esp32_manager.check_esp32_connection_smart()
        except Exception as e:
            app.logger.error(f"Error checking smart connection: {e}")
            status.serial_connected = False
        
        status.last_update = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'serialConnected': status.serial_connected,
            'currentMode': status.current_mode,
            'lastUpdate': status.last_update.timestamp() * 1000,
            'esp32Status': status.esp32_status
        })
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/check_connection', methods=['GET'])
def check_connection():
    """Check ESP32 connection using smart detection (no ping interference)."""
    try:
        # Use smart detection method that only pings once
        is_connected = esp32_manager.check_esp32_connection_smart()
        status = esp32_manager.connection_status
        
        # Update system status
        system_status['esp32_connected'] = is_connected
        system_status['last_esp32_check'] = datetime.now().isoformat()
        
        if is_connected:
            logger.info(f"✅ [SMART] ESP32 connected at {status['port']} - method: {status['method']}")
            return jsonify({
                'connected': True,
                'port': status['port'],
                'last_check': status['last_check'],
                'timestamp': datetime.now().isoformat(),
                'method': status['method'],
                'status': status['status'],
                'smart_detection': True
            })
        else:
            logger.info(f"❌ [SMART] ESP32 not connected - method: {status.get('method', 'unknown')}")
            return jsonify({
                'connected': False,
                'port': status.get('port'),
                'error': status.get('status', 'ESP32 not detected'),
                'timestamp': datetime.now().isoformat(),
                'method': status.get('method', 'smart_detection'),
                'status': status.get('status', 'disconnected'),
                'smart_detection': True,
                'available_ports': [str(p.device) for p in serial.tools.list_ports.comports()]
            })
            
    except Exception as e:
        logger.error(f"Unexpected error in check_connection: {str(e)}", exc_info=True)
        system_status['esp32_connected'] = False
        return jsonify({
            'connected': False,
            'error': 'Connection check failed',
            'details': str(e),
            'timestamp': datetime.now().isoformat()
        })

def check_serial_connection():
    """Check if ESP32 is connected via serial with robust protocol"""
    try:
        port = find_esp32_port()
        if not port:
            logger.warning("No ESP32 device found for serial connection check")
            return False
        
        logger.info(f"=== ROBUST SERIAL CONNECTION CHECK ===")
        logger.info(f"Attempting to connect to ESP32 on port {port}")
        
        try:
            # Use longer timeout for more reliable communication
            with serial.Serial(port, 115200, timeout=3) as ser:
                # Clear any existing data in buffers
                ser.reset_input_buffer()
                ser.reset_output_buffer()
                
                # Send PING command (matching ESP32 case expectation)
                logger.info("Sending PING command to ESP32")
                ser.write(b'PING\n')
                ser.flush()
                
                # Wait for response with multiple attempts
                max_attempts = 3
                for attempt in range(max_attempts):
                    time.sleep(0.5)  # Give ESP32 time to respond
                    
                    if ser.in_waiting > 0:
                        response = ser.readline().decode('utf-8', errors='ignore').strip()
                        logger.info(f"ESP32 response (attempt {attempt + 1}): '{response}'")
                        
                        if response == 'PONG':
                            logger.info("✅ ESP32 serial connection verified successfully")
                            return True
                    
                    logger.warning(f"No valid response on attempt {attempt + 1}, retrying...")
                
                # All attempts failed
                logger.error("❌ ESP32 failed to respond via serial after all attempts")
                return False
                
        except serial.SerialException as se:
            error_msg = f"Serial communication error on port {port}: {str(se)}"
            logger.error(error_msg)
            return False
            
    except Exception as e:
        error_msg = f"Unexpected error during serial connection check: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return False

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        logger.info("=== FILE UPLOAD ENDPOINT CALLED ===")
        
        # Check if file is in request
        if 'file' not in request.files:
            logger.error("No file in request")
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        face = request.form.get('face')
        
        logger.info(f"Upload request - Face: {face}, File: {file.filename}")
        
        if not face:
            logger.error("No face specified")
            return jsonify({'error': 'Face parameter required'}), 400
        
        if file.filename == '':
            logger.error("Empty filename")
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            logger.error("File type not allowed")
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Map face names to single letters expected by process_cube.py
        face_mapping = {
            'top': 'U',
            'right': 'R', 
            'front': 'F',
            'bottom': 'D',
            'left': 'L',
            'back': 'B'
        }
        
        # Save file with cube notation name
        cube_face = face_mapping.get(face, face)
        filename = f'face_{cube_face}.jpg'
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        logger.info(f"File saved to: {filepath}")
        
        # Generate mock face colors for immediate response
        face_colors = generate_mock_face_colors(face)
        logger.info(f"Generated face colors for {face}: {face_colors}")
        
        # Check if all faces are now uploaded
        if check_all_faces_uploaded():
            logger.info("All 6 faces uploaded! Starting cube processing and solution generation...")
            
            # Clear any previous moves to prevent reusing old solutions
            clear_previous_moves()
            
            # Process cube images to generate cube state
            processing_result = process_cube_images_with_diagnostics()
            
            if processing_result['success']:
                logger.info("Cube images processed successfully")
                
                # Generate solution moves
                solving_result = solve_cube_with_diagnostics()
                
                if solving_result['success']:
                    logger.info("Cube solution generated successfully")
                    # Both processing and solving succeeded - return success response
                    response_data = {
                        'faceColors': face_colors,
                        'processed': True,
                        'face': face,
                        'filename': filename,
                        'timestamp': datetime.utcnow().isoformat(),
                        'allFacesUploaded': True
                    }
                else:
                    logger.warning("Failed to generate cube solution")
                    logger.error(f"Solving diagnostics: {solving_result.get('diagnostics', {})})")
                    logger.error("❌ CUBE SOLVING FAILED - Check cube state validity")
                    # Solving failed - return error response
                    return jsonify({
                        'error': 'Cube solving failed',
                        'message': 'Cube state may be invalid or unsolvable',
                        'face': face,
                        'timestamp': datetime.utcnow().isoformat(),
                        'processingFailed': True
                    }), 400
            else:
                logger.warning("Failed to process cube images")
                logger.error(f"Processing diagnostics: {processing_result.get('diagnostics', {})})")
                logger.error("❌ IMAGE PROCESSING FAILED - User should try: better lighting, proper alignment, clear focus")
                # Processing failed - return error response
                return jsonify({
                    'error': 'Image processing failed',
                    'message': 'Try better lighting and proper cube alignment',
                    'face': face,
                    'timestamp': datetime.utcnow().isoformat(),
                    'processingFailed': True
                }), 400
        else:
            # Not all faces uploaded yet - normal response for individual images
            response_data = {
                'faceColors': face_colors,
                'processed': True,
                'face': face,
                'filename': filename,
                'timestamp': datetime.utcnow().isoformat(),
                'allFacesUploaded': False
            }
        
        logger.info(f"Returning successful response: {response_data}")
        return jsonify(response_data)
        
    except Exception as e:
        error_msg = f"Error uploading file: {str(e)}"
        logger.error(f"CRITICAL ERROR: {error_msg}")
        return jsonify({'error': error_msg}), 500

# Start ESP32 scanning process for Solving Mode
@app.route('/api/start_scan', methods=['POST'])
def start_scan():
    """Send SCAN command to ESP32 to start the scanning process in Solving Mode."""
    try:
        logger.info("=== START SCAN ENDPOINT CALLED ===")
        logger.info("Sending SCAN command to ESP32 for cube scanning")
        
        # Clear previous face images and solution files for fresh scan
        logger.info("🧹 Clearing previous scan data for fresh start...")
        clear_previous_face_images()
        clear_previous_moves()
        
        # Reset solving state to allow new solving session
        global solving_in_progress
        solving_in_progress = False
        logger.info("♾️ Reset solving state - ready for new solving session")
        
        # Ensure connection manager is running
        if not esp32_manager.is_running:
            logger.info("Starting ESP32 connection manager for scan command...")
            if not esp32_manager.start():
                return jsonify({'error': 'Could not establish ESP32 connection'}), 500
        
        # Send SCAN command via persistent connection
        result = esp32_manager.send_command('SCAN', wait_for_response=True)
        
        if result['success']:
            logger.info("SCAN command sent successfully to ESP32")
            return jsonify({
                'success': True,
                'message': 'ESP32 scanning started',
                'command': 'SCAN',
                'method': 'persistent_connection',
                'response': result.get('response', 'Command sent')
            })
        else:
            logger.error(f"Failed to send SCAN command: {result.get('error', 'Unknown error')}")
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to send SCAN command'),
                'command': 'SCAN'
            }), 500
        
    except Exception as e:
        error_msg = f"Error starting ESP32 scan: {str(e)}"
        logger.error(f"CRITICAL ERROR: {error_msg}")
        return jsonify({'error': error_msg}), 500

# Grip cube for Solving Mode
@app.route('/api/grip_cube', methods=['POST'])
def grip_cube():
    """Send GRIP command to ESP32 to have robot grab the cube in Solving Mode."""
    try:
        logger.info("=== GRIP CUBE ENDPOINT CALLED ===")
        logger.info("Sending GRIP command to ESP32 for cube gripping")
        
        # Ensure connection manager is running
        if not esp32_manager.is_running:
            logger.info("Starting ESP32 connection manager for grip command...")
            if not esp32_manager.start():
                return jsonify({'error': 'Could not establish ESP32 connection'}), 500
        
        # Send GRIP command via persistent connection (fire-and-forget for reliability)
        result = esp32_manager.send_command('GRIP', wait_for_response=False)
        
        if result['success']:
            logger.info("GRIP command sent successfully to ESP32")
            return jsonify({
                'success': True,
                'message': 'ESP32 cube gripping started',
                'command': 'GRIP',
                'method': 'persistent_connection',
                'response': result.get('response', 'Command sent')
            })
        else:
            logger.error(f"Failed to send GRIP command: {result.get('error', 'Unknown error')}")
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to send GRIP command'),
                'command': 'GRIP'
            }), 500
        
    except Exception as e:
        error_msg = f"Error gripping cube: {str(e)}"
        logger.error(f"CRITICAL ERROR: {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/get_moves', methods=['GET'])
def get_moves():
    """Get solution moves from moves.txt file"""
    try:
        moves_file = 'moves.txt'
        if os.path.exists(moves_file):
            with open(moves_file, 'r') as f:
                moves = f.read().strip()
            
            if moves:
                logger.info(f"Retrieved moves: {moves}")
                return jsonify({'moves': moves})
            else:
                return jsonify({'moves': None, 'status': 'processing'})
        else:
            return jsonify({'moves': None, 'status': 'waiting'})
    except Exception as e:
        logger.error(f"Error getting moves: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Global variable to track solving state
solving_in_progress = False

# Global variable to store solve timing
last_solve_time = None

@app.route('/api/get_solve_time', methods=['GET'])
def get_solve_time():
    """Get the last recorded solve time from the robot."""
    global last_solve_time
    try:
        if last_solve_time is not None:
            return jsonify({
                'solve_time': round(last_solve_time, 1),
                'available': True
            })
        else:
            return jsonify({
                'solve_time': None,
                'available': False
            })
    except Exception as e:
        logger.error(f"Error getting solve time: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/start_solving', methods=['POST'])
def start_solving():
    """Start the cube solving process on the ESP32 with accurate timing."""
    global solving_in_progress, last_solve_time
    
    try:
        # Check if solving is already in progress for this scan session
        if solving_in_progress:
            logger.warning("⚠️ Solving already in progress - ignoring duplicate request")
            return jsonify({
                'error': 'Solving already in progress. Please wait for the robot to complete, then start a new scan to solve again.',
                'message': 'The robot is currently executing moves. To solve again, click "Start Scanning" for a new session.',
                'status': 'already_solving'
            }), 400
        
        logger.info("=== START SOLVING ENDPOINT CALLED ===")
        
        # Read moves from file
        moves_file = 'moves.txt'
        if not os.path.exists(moves_file):
            return jsonify({'error': 'No solution available. Please scan the cube first.'}), 400
        
        with open(moves_file, 'r') as f:
            moves = f.read().strip()
        
        if not moves:
            return jsonify({'error': 'No moves available'}), 400
        
        logger.info(f"Sending moves to ESP32: {moves}")
        
        # Set solving state to prevent duplicate requests
        solving_in_progress = True
        logger.info("🔒 Solving state locked - preventing duplicate requests")
        
        # Use ESP32 connection manager for better timing accuracy
        if not esp32_manager.is_running:
            if not esp32_manager.start():
                solving_in_progress = False
                return jsonify({'error': 'Could not establish ESP32 connection'}), 500
        
        # Start timing when we send the moves
        start_time = time.time()
        logger.info(f"⏱️ Starting solve timer at: {start_time}")
        
        # Send moves to ESP32 and wait for completion
        result = esp32_manager.send_command(moves, wait_for_response=True)
        
        # Calculate actual robot execution time
        end_time = time.time()
        actual_solve_time = end_time - start_time
        last_solve_time = actual_solve_time
        
        logger.info(f"⏱️ Robot solve completed in: {actual_solve_time:.2f} seconds")
        
        # Reset solving state
        solving_in_progress = False
        
        if result.get('success'):
            logger.info("✅ Robot solving completed successfully")
            return jsonify({
                'success': True, 
                'message': 'Robot solved the cube successfully!',
                'moves': moves,
                'solve_time': round(actual_solve_time, 1),
                'status': 'completed'
            })
        else:
            logger.error(f"❌ Robot solving failed: {result.get('error')}")
            return jsonify({
                'error': f'Robot solving failed: {result.get("error", "Unknown error")}',
                'solve_time': round(actual_solve_time, 1)
            }), 500
        
    except Exception as e:
        solving_in_progress = False
        error_msg = f"Error starting solving: {str(e)}"
        logger.error(f"CRITICAL ERROR: {error_msg}")
        return jsonify({'error': error_msg}), 500

def generate_mock_face_colors(face):
    """Generate mock 3x3 face colors for testing"""
    face_color_map = {
        'top': 'W',      # White
        'front': 'G',    # Green
        'right': 'R',    # Red
        'back': 'B',     # Blue
        'left': 'O',     # Orange
        'bottom': 'Y'    # Yellow
    }
    
    center_color = face_color_map.get(face.lower(), 'W')
    # Return a 3x3 grid with the center color (9 characters)
    return center_color * 9

@app.route('/api/solving-session', methods=['GET'])
def get_active_solving_session():
    try:
        user = get_current_user()
        session = SolvingSession.query.filter_by(
            user_id=user.id if user else None,
            is_active=True
        ).first()
        
        if not session:
            return jsonify(None)
        
        return jsonify({
            'id': session.id,
            'userId': session.user_id,
            'cubeState': session.cube_state,
            'moves': session.moves or [],
            'currentStep': session.current_step,
            'totalSteps': session.total_steps,
            'elapsedTime': session.elapsed_time,
            'progressPercent': session.progress_percent,
            'isActive': session.is_active,
            'status': session.status,
            'startTime': session.start_time.timestamp() * 1000,
            'endTime': session.end_time.timestamp() * 1000 if session.end_time else None
        })
    except Exception as e:
        logger.error(f"Error getting solving session: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cfop-steps', methods=['GET'])
def get_cfop_steps():
    try:
        # Return CFOP steps data as a dictionary
        steps = {
            'cross': {
                'name': 'Cross',
                'description': 'Form a cross on the bottom face',
                'steps': [
                    {'moves': 'F D R\' U\' R F\'', 'description': 'Basic cross pattern'},
                    {'moves': 'R U R\' F R F\'', 'description': 'Advanced cross technique'}
                ]
            },
            'f2l': {
                'name': 'F2L',
                'description': 'First Two Layers',
                'steps': [
                    {'moves': 'R U\' R\' F R F\'', 'description': 'Basic F2L pair'},
                    {'moves': 'F R U R\' U\' F\'', 'description': 'Corner-edge pairing'}
                ]
            },
            'oll': {
                'name': 'OLL',
                'description': 'Orientation of Last Layer',
                'steps': [
                    {'moves': 'F R U R\' U\' F\'', 'description': 'OLL algorithm 1'},
                    {'moves': 'R U R\' U R U2 R\'', 'description': 'OLL algorithm 2'}
                ]
            },
            'pll': {
                'name': 'PLL',
                'description': 'Permutation of Last Layer',
                'steps': [
                    {'moves': 'R U R\' F\' R U R\' U\' R\' F R2 U\' R\'', 'description': 'T-perm'},
                    {'moves': 'R\' U R\' U\' R\' U\' R\' U R U R2', 'description': 'A-perm'}
                ]
            }
        }
        
        return jsonify(steps)
    except Exception as e:
        logger.error(f"Error getting CFOP steps: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/learning-progress', methods=['GET'])
def get_learning_progress():
    try:
        user = get_current_user()
        progress = LearningProgress.query.filter_by(
            user_id=user.id if user else None
        ).first()
        
        if not progress:
            progress = LearningProgress(user_id=user.id if user else None)
            db.session.add(progress)
            db.session.commit()
        
        return jsonify({
            'currentStep': progress.current_step,
            'stepIndex': progress.step_index,
            'completedSteps': progress.completed_steps or [],
            'practiceCount': progress.practice_count
        })
    except Exception as e:
        logger.error(f"Error getting learning progress: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Send individual move to ESP32 for Learning Mode
@app.route('/api/send_move', methods=['POST'])
def send_move():
    """Send a single move to the ESP32 for Learning Mode using persistent connection."""
    try:
        data = request.get_json()
        if not data or 'move' not in data:
            return jsonify({'error': 'Move is required'}), 400
        
        move = data['move'].strip()
        if not move:
            return jsonify({'error': 'Move cannot be empty'}), 400
        
        logger.info(f"=== SEND MOVE ENDPOINT CALLED ===")
        logger.info(f"Sending single move to ESP32: {move}")
        
        # Ensure connection manager is running
        if not esp32_manager.is_running:
            logger.info("Starting ESP32 connection manager for move command...")
            if not esp32_manager.start():
                return jsonify({'error': 'Could not establish ESP32 connection'}), 500
        
        # Send move command via persistent connection (fire-and-forget for real-time feel)
        result = esp32_manager.send_command(move, wait_for_response=False)
        
        if result['success']:
            logger.info(f"Move '{move}' queued successfully for ESP32 execution")
            return jsonify({
                'success': True,
                'message': f"Move '{move}' sent to ESP32",
                'move': move,
                'method': 'persistent_connection_async'
            })
        else:
            logger.error(f"Failed to queue move '{move}': {result.get('error', 'Unknown error')}")
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to send move'),
                'move': move
            }), 500
        
    except Exception as e:
        error_msg = f"Error sending move: {str(e)}"
        logger.error(f"CRITICAL ERROR: {error_msg}")
        return jsonify({'error': error_msg}), 500

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

# Serve uploaded files
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Initialize database
def create_tables():
    with app.app_context():
        db.create_all()
        logger.info("Database tables created successfully!")

if __name__ == '__main__':
    create_tables()
    app.run(debug=True, host='0.0.0.0', port=5000)
