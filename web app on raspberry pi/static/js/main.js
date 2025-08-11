// CUBOT Main Application
import { CubeRenderer } from './modules/cubeRenderer.js';
import { WebSocketManager } from './modules/websocket.js';
import { UIManager } from './modules/ui.js';
import { SolvingMode } from './modules/solvingMode.js';
import { LearningMode } from './modules/learningMode.js';

class CubotApp {
  constructor() {
    this.cubeRenderer = null;
    this.websocket = null;
    this.ui = null;
    this.solvingMode = null;
    this.learningMode = null;
    this.currentMode = 'solving';
    
    this.init();
  }
  
  async init() {
    try {
      // Initialize cube renderer
      this.cubeRenderer = new CubeRenderer('cubeCanvas');
      await this.cubeRenderer.init();
      
      // Initialize WebSocket connection
      this.websocket = new WebSocketManager();
      this.websocket.connect();
      
      // Initialize UI manager
      this.ui = new UIManager();
      
      // Initialize mode managers
      this.solvingMode = new SolvingMode(this.websocket, this.cubeRenderer, this.ui);
      this.learningMode = new LearningMode(this.websocket, this.cubeRenderer, this.ui);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set up WebSocket event handlers
      this.setupWebSocketHandlers();
      
      console.log('CUBOT application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CUBOT application:', error);
    }
  }
  
  setupEventListeners() {
    // Mode switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.switchMode(mode);
      });
    });
    
    // Manual move buttons
    document.querySelectorAll('.move-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const move = e.currentTarget.dataset.move;
        this.executeManualMove(move);
      });
    });
    
    // Window resize handler
    window.addEventListener('resize', () => {
      if (this.cubeRenderer) {
        this.cubeRenderer.handleResize();
      }
    });
  }
  
  setupWebSocketHandlers() {
    this.websocket.on('connect', () => {
      this.ui.updateConnectionStatus(true);
      console.log('Connected to CUBOT server');
    });
    
    this.websocket.on('disconnect', () => {
      this.ui.updateConnectionStatus(false);
      console.log('Disconnected from CUBOT server');
    });
    
    this.websocket.on('status_update', (data) => {
      this.handleStatusUpdate(data);
    });
    
    this.websocket.on('mode_switched', (data) => {
      this.currentMode = data.mode;
      this.ui.switchMode(data.mode);
    });
    
    this.websocket.on('move_executed', (data) => {
      this.cubeRenderer.executeMove(data.move);
      this.ui.showMoveExecuted(data.move);
    });
    
    this.websocket.on('serial_response', (data) => {
      console.log('Serial response:', data);
      this.ui.showSerialFeedback(data);
    });
    
    this.websocket.on('error', (data) => {
      console.error('Server error:', data);
      this.ui.showError(data.message);
    });
  }
  
  switchMode(mode) {
    if (mode === this.currentMode) return;
    
    this.currentMode = mode;
    this.websocket.emit('switch_mode', { mode });
    this.ui.switchMode(mode);
    
    // Update cube renderer mode
    this.cubeRenderer.setMode(mode);
    
    // Activate appropriate mode manager
    if (mode === 'solving') {
      this.solvingMode.activate();
      this.learningMode.deactivate();
    } else {
      this.learningMode.activate();
      this.solvingMode.deactivate();
    }
  }
  
  executeManualMove(move) {
    this.websocket.emit('manual_move', { move });
    this.cubeRenderer.executeMove(move);
  }
  
  handleStatusUpdate(data) {
    this.ui.updateConnectionStatus(data.serial_connected);
    
    if (data.solving_progress) {
      this.solvingMode.updateProgress(data.solving_progress);
    }
    
    if (data.learning_progress) {
      this.learningMode.updateProgress(data.learning_progress);
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CubotApp();
});
