// Solving Mode Manager
export class SolvingMode {
  constructor(websocket, cubeRenderer, ui) {
    this.websocket = websocket;
    this.cubeRenderer = cubeRenderer;
    this.ui = ui;
    this.isActive = false;
    this.isSolving = false;
    
    this.setupEventListeners();
    this.setupWebSocketHandlers();
  }
  
  setupEventListeners() {
    // Start solving button
    const startButton = document.getElementById('startSolving');
    if (startButton) {
      startButton.addEventListener('click', () => {
        this.startSolving();
      });
    }
    
    // Stop solving button
    const stopButton = document.getElementById('stopSolving');
    if (stopButton) {
      stopButton.addEventListener('click', () => {
        this.stopSolving();
      });
    }
    
    // Scramble cube button
    const scrambleButton = document.getElementById('scrambleCube');
    if (scrambleButton) {
      scrambleButton.addEventListener('click', () => {
        this.scrambleCube();
      });
    }
  }
  
  setupWebSocketHandlers() {
    this.websocket.on('solving_started', (data) => {
      this.handleSolvingStarted(data);
    });
    
    this.websocket.on('solving_progress', (data) => {
      this.handleSolvingProgress(data);
    });
    
    this.websocket.on('solving_completed', (data) => {
      this.handleSolvingCompleted(data);
    });
    
    this.websocket.on('solving_stopped', () => {
      this.handleSolvingStopped();
    });
  }
  
  activate() {
    this.isActive = true;
    this.cubeRenderer.setMode('solving');
    this.resetProgress();
    console.log('Solving mode activated');
  }
  
  deactivate() {
    this.isActive = false;
    if (this.isSolving) {
      this.stopSolving();
    }
    console.log('Solving mode deactivated');
  }
  
  startSolving() {
    if (this.isSolving) {
      this.ui.showNotification('Already solving!', 'warning');
      return;
    }
    
    console.log('Starting cube solving...');
    this.websocket.emit('start_solving', {
      cube_state: this.getCurrentCubeState()
    });
    
    this.ui.updateCubeInfo('Starting solve...');
  }
  
  stopSolving() {
    if (!this.isSolving) {
      return;
    }
    
    console.log('Stopping cube solving...');
    this.websocket.emit('stop_solving');
    this.ui.updateCubeInfo('Stopping...');
  }
  
  scrambleCube() {
    if (this.isSolving) {
      this.ui.showNotification('Cannot scramble while solving!', 'warning');
      return;
    }
    
    console.log('Scrambling cube...');
    
    // Generate random scramble moves
    const moves = ['R', "R'", 'U', "U'", 'F', "F'", 'L', "L'", 'D', "D'", 'B', "B'"];
    const scrambleMoves = [];
    
    for (let i = 0; i < 20; i++) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      scrambleMoves.push(randomMove);
    }
    
    // Execute scramble moves
    scrambleMoves.forEach((move, index) => {
      setTimeout(() => {
        this.websocket.emit('manual_move', { move });
        this.cubeRenderer.executeMove(move);
        
        if (index === scrambleMoves.length - 1) {
          this.ui.updateCubeInfo('Scrambled - Ready to solve');
        }
      }, index * 200);
    });
    
    this.ui.updateCubeInfo('Scrambling...');
    this.ui.showNotification('Cube scrambled!', 'info');
  }
  
  handleSolvingStarted(data) {
    this.isSolving = true;
    this.ui.setButtonState('startSolving', false);
    this.ui.setButtonState('stopSolving', true);
    this.ui.setButtonState('scrambleCube', false);
    
    this.ui.updateCubeInfo(`Solving with ${data.total_moves} moves...`);
    this.ui.showNotification('Solving started!', 'info');
    
    console.log('Solving started:', data);
  }
  
  handleSolvingProgress(data) {
    if (!this.isActive) return;
    
    this.ui.updateSolvingProgress(data);
    
    if (data.current_move) {
      this.cubeRenderer.executeMove(data.current_move);
    }
    
    console.log('Solving progress:', data);
  }
  
  handleSolvingCompleted(data) {
    this.isSolving = false;
    this.ui.setButtonState('startSolving', true);
    this.ui.setButtonState('stopSolving', false);
    this.ui.setButtonState('scrambleCube', true);
    
    const minutes = Math.floor(data.total_time / 60);
    const seconds = Math.floor(data.total_time % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    this.ui.updateCubeInfo(`Solved in ${timeStr} with ${data.total_moves} moves!`);
    this.ui.showNotification(`Cube solved in ${timeStr}!`, 'success');
    
    console.log('Solving completed:', data);
  }
  
  handleSolvingStopped() {
    this.isSolving = false;
    this.ui.setButtonState('startSolving', true);
    this.ui.setButtonState('stopSolving', false);
    this.ui.setButtonState('scrambleCube', true);
    
    this.ui.updateCubeInfo('Solving stopped');
    this.ui.showNotification('Solving stopped', 'warning');
    
    console.log('Solving stopped');
  }
  
  updateProgress(progress) {
    if (!this.isActive) return;
    
    this.ui.updateSolvingProgress(progress);
    
    if (progress.is_solving !== this.isSolving) {
      this.isSolving = progress.is_solving;
      this.ui.setButtonState('startSolving', !this.isSolving);
      this.ui.setButtonState('stopSolving', this.isSolving);
      this.ui.setButtonState('scrambleCube', !this.isSolving);
    }
  }
  
  resetProgress() {
    this.ui.updateSolvingProgress({
      current_step: 0,
      total_steps: 0,
      elapsed_time: 0,
      progress_percent: 0,
      current_move: null
    });
    
    this.ui.updateCubeInfo('Ready to solve');
  }
  
  getCurrentCubeState() {
    // Return current cube state - in a real implementation, this would
    // read the actual cube state from the renderer or camera
    return "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
  }
}
