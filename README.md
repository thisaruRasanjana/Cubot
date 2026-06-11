# Cubot - Rubik's Cube Robot

Cubot is an intelligent, physical Rubik's Cube solving robot. It features a modern web interface to scan a scrambled cube using a camera, computes the optimal solution using computer vision and the Kociemba algorithm, and physically solves it using a 4-arm servo-based robotic system.

## System Architecture

The project is divided into two main components:

1. **Hardware Controller (ESP32)**  
   The `esp32code/` directory contains the C++ firmware for the ESP32 microcontroller. The ESP32 is responsible for:
   - Driving the servos using a PCA9685 PWM driver to manipulate the 4 robotic arms.
   - Receiving serial commands (cube notation like "R U R' U'") from the Raspberry Pi and translating them into physical servo movements.
   - Sending confirmation back to the host once a sequence of moves is completed.

2. **Web Application & Vision (Raspberry Pi)**  
   The `web app on raspberry pi/` directory contains a full-stack web application designed to run on a Raspberry Pi.
   - **Frontend**: A modern React (TypeScript) and Tailwind CSS web interface that allows users to scan the cube, track the solving progress, and even learn CFOP step-by-step.
   - **Backend**: A Python Flask server that handles the camera inputs, processes the cube images using OpenCV color detection, and computes the optimal solution utilizing the Kociemba algorithm.
   - **Communication**: The backend communicates directly with the ESP32 via serial over USB to send the generated moves to the robot.

## Repository Structure

```
├── esp32code/                   # ESP32 C++ firmware for servo control
│   └── esp32code.ino            # Main Arduino sketch
├── web app on raspberry pi/     # Full-stack app for vision, solving, and UI
│   ├── app.py                   # Flask backend
│   ├── src/                     # React frontend source
│   ├── process_cube.py          # OpenCV computer vision logic
│   ├── solve_cube.py            # Kociemba algorithm integration
│   └── README.md                # Detailed setup guide for the web app
└── README.md                    # This file
```

## Getting Started

### Setting up the Hardware (ESP32)
1. Open `esp32code/esp32code.ino` using the Arduino IDE.
2. Install the required libraries (`Adafruit_PWMServoDriver`).
3. Flash the code to your ESP32.

### Setting up the Software (Raspberry Pi)
Please refer to the detailed [Web App README](web%20app%20on%20raspberry%20pi/README.md) for instructions on:
- Installing Python dependencies for OpenCV and Flask.
- Installing Node.js dependencies for the React frontend.
- Connecting the Raspberry Pi to the ESP32.
- Running the servers.

## Features

- **Automated Solving:** Uses a camera to detect the cube state and physically solves it.
- **Interactive UI:** A glassmorphism-styled web interface to control the robot.
- **Learning Mode:** A CFOP method tutorial built into the app to help users learn to solve the cube themselves.
