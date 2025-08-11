# CUBOT - Rubik's Cube Robot (Flask Edition)

A modern web application for controlling and learning from a Rubik's Cube solving robot, powered by Flask backend with real-time cube processing and ESP32 integration.

## Features

### Frontend
- **Modern React Interface**: Responsive design with glassmorphism UI
- **Camera Integration**: Real-time cube face scanning using device camera
- **Dual Mode Interface**: 
  - **Solving Mode**: Live progress tracking, timing, and move counting
  - **Learning Mode**: Interactive CFOP method tutorial with step-by-step guidance
- **Real-time Updates**: Live status monitoring and progress tracking
- **Mobile Optimized**: Touch-friendly interface for all devices

### Backend (Flask)
- **File Upload Processing**: Handle cube face image uploads
- **Computer Vision**: OpenCV-based color detection and cube state analysis
- **Cube Solving**: Kociemba algorithm integration for optimal solutions
- **Serial Communication**: Direct ESP32 robot control via serial interface
- **Database Management**: SQLAlchemy for user sessions and progress tracking
- **CFOP Learning System**: Complete Cross, F2L, OLL, PLL tutorial database

### Hardware Integration
- **ESP32 Communication**: Serial protocol for robot control
- **Real-time Feedback**: Monitor solving progress and completion
- **Multi-port Support**: Automatic detection of ESP32 connection
- **Error Handling**: Robust communication with timeout protection

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Flask + SQLAlchemy
- **Computer Vision**: OpenCV + NumPy
- **Cube Solving**: Kociemba algorithm
- **Hardware**: ESP32 via PySerial
- **Styling**: Tailwind CSS
- **Database**: SQLite (development) / PostgreSQL (production)

## Installation

### Prerequisites
- Python 3.8+
- Node.js 18+
- npm or yarn
- ESP32 with cube robot firmware

### Backend Setup

1. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Initialize database**
   ```bash
   python run_flask.py
   ```

### Frontend Setup

1. **Install Node dependencies**
   ```bash
   npm install
   ```

2. **Start development servers**
   ```bash
   # Terminal 1: Flask backend
   python run_flask.py
   
   # Terminal 2: React frontend  
   npm run dev:frontend
   ```

## Usage Flow

### 1. Cube Scanning
- Click "Start Scanning" in Solving Mode
- Follow on-screen instructions to capture all 6 faces
- Camera interface guides you through each face (top, right, front, bottom, left, back)
- Images are automatically uploaded and processed

### 2. Image Processing
- Flask receives uploaded images in `/uploads/` directory
- `process_cube.py` analyzes each face using OpenCV
- Color detection generates 3x3 grid for each face
- Cube state is saved to `cube_state.txt`

### 3. Solution Generation
- `solve_cube.py` reads cube state and generates solution
- Uses Kociemba algorithm for optimal move sequence
- Solution moves saved to `moves.txt`
- Frontend polls `/api/get_moves` for real-time updates

### 4. Robot Execution
- Click "Start Solving" when solution is ready
- Flask sends moves to ESP32 via serial communication
- Robot executes moves and sends completion confirmation
- Real-time status updates throughout process

## File Structure

```
cubot-flask/
├── app.py                 # Main Flask application
├── process_cube.py        # Computer vision processing
├── solve_cube.py          # Cube solving algorithms
├── run_flask.py          # Flask server launcher
├── requirements.txt       # Python dependencies
├── uploads/              # Cube face images
├── src/
│   ├── components/
│   │   ├── CameraScanner.tsx    # Camera interface
│   │   ├── SolvingInterface.tsx # Main solving UI
│   │   └── ...
│   ├── lib/
│   │   └── api.ts        # Flask API client
│   └── App.tsx           # Main React app
└── package.json          # Node dependencies
```

## API Endpoints

### Core Endpoints
- `POST /api/upload` - Upload cube face images
- `GET /api/get_moves` - Retrieve solution moves
- `POST /api/start_solving` - Begin robot execution
- `GET /api/system-status` - Check robot connection

### Learning Endpoints
- `GET /api/cfop-steps` - CFOP tutorial content
- `GET /api/learning-progress` - User learning progress
- `POST /api/learning-progress` - Update progress

## Hardware Requirements

### ESP32 Robot
- Stepper motors for cube manipulation
- Serial communication (115200 baud)
- Move parsing and execution firmware
- Completion confirmation protocol

### Supported Serial Ports
- Linux: `/dev/ttyUSB0`, `/dev/ttyACM0`
- Windows: `COM3`, `COM4`
- Auto-detection with fallback

## Configuration

### Environment Variables
```bash
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///cubot.db
```

### Camera Settings
- Preferred resolution: 1280x720
- Fallback resolution: 640x480
- Format: JPEG with 85% quality
- Auto-focus and environment camera preferred

## Development

### Adding New Features
1. **Backend**: Add routes to `app.py`
2. **Processing**: Extend `process_cube.py` or `solve_cube.py`
3. **Frontend**: Create React components in `src/components/`
4. **API**: Update `src/lib/api.ts` for new endpoints

### Testing
- Use mock data in `solve_cube.py` when Kociemba unavailable
- Camera simulator for development without hardware
- Serial port mocking for robot-less testing

## Troubleshooting

### Common Issues
1. **Camera Access**: Ensure HTTPS or localhost for camera permissions
2. **Serial Connection**: Check ESP32 port and baud rate
3. **Image Processing**: Verify OpenCV installation and image quality
4. **Cube Solving**: Install Kociemba: `pip install kociemba`

### Debug Mode
- Flask runs in debug mode by default
- Check browser console for frontend errors
- Monitor Flask logs for backend issues
- Use `/api/health` endpoint for system status

## Production Deployment

### Backend
- Use production WSGI server (Gunicorn)
- Configure PostgreSQL database
- Set proper environment variables
- Enable HTTPS for camera access

### Frontend
- Build with `npm run build`
- Serve static files with nginx
- Configure API proxy for production

## Contributing

1. Fork the repository
2. Create feature branch
3. Test thoroughly with hardware
4. Submit pull request

## License

This project is open source. See individual component licenses for details.

## Hardware Integration Notes

The system is designed to work with ESP32-based cube robots that:
- Accept move strings via serial (e.g., "R U R' U'")
- Execute moves sequentially
- Send "over" confirmation when complete
- Support standard cube notation (R, L, U, D, F, B, ', 2)

For robot firmware examples and hardware schematics, see the hardware documentation.
