// Learning Mode Manager
export class LearningMode {
  constructor(websocket, cubeRenderer, ui) {
    this.websocket = websocket;
    this.cubeRenderer = cubeRenderer;
    this.ui = ui;
    this.isActive = false;
    
    this.currentStep = 'cross';
    this.currentStepIndex = 0;
    this.cfopSteps = {};
    
    this.setupEventListeners();
    this.setupWebSocketHandlers();
    this.loadCFOPSteps();
  }
  
  setupEventListeners() {
    // Step selector buttons
    document.querySelectorAll('.step-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const step = e.currentTarget.dataset.step;
        this.selectStep(step);
      });
    });
    
    // Navigation buttons
    const prevButton = document.getElementById('prevStep');
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        this.previousStep();
      });
    }
    
    const nextButton = document.getElementById('nextStep');
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        this.nextStep();
      });
    }
    
    // Learning control buttons
    const demonstrateButton = document.getElementById('demonstrateStep');
    if (demonstrateButton) {
      demonstrateButton.addEventListener('click', () => {
        this.demonstrateStep();
      });
    }
    
    const practiceButton = document.getElementById('practiceStep');
    if (practiceButton) {
      practiceButton.addEventListener('click', () => {
        this.practiceStep();
      });
    }
  }
  
  setupWebSocketHandlers() {
    this.websocket.on('learning_step_started', (data) => {
      this.handleLearningStepStarted(data);
    });
  }
  
  async loadCFOPSteps() {
    try {
      const response = await fetch('/api/cfop_steps');
      this.cfopSteps = await response.json();
      this.updateStepDisplay();
      console.log('CFOP steps loaded:', this.cfopSteps);
    } catch (error) {
      console.error('Failed to load CFOP steps:', error);
      this.ui.showError('Failed to load learning content');
    }
  }
  
  activate() {
    this.isActive = true;
    this.cubeRenderer.setMode('learning');
    this.updateStepDisplay();
    console.log('Learning mode activated');
  }
  
  deactivate() {
    this.isActive = false;
    console.log('Learning mode deactivated');
  }
  
  selectStep(stepName) {
    if (stepName in this.cfopSteps) {
      this.currentStep = stepName;
      this.currentStepIndex = 0;
      this.updateStepDisplay();
      
      console.log(`Selected step: ${stepName}`);
    }
  }
  
  previousStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.updateStepDisplay();
    }
  }
  
  nextStep() {
    const stepData = this.cfopSteps[this.currentStep];
    if (stepData && this.currentStepIndex < stepData.steps.length - 1) {
      this.currentStepIndex++;
      this.updateStepDisplay();
    }
  }
  
  demonstrateStep() {
    const stepData = this.cfopSteps[this.currentStep];
    if (!stepData || !stepData.steps[this.currentStepIndex]) {
      this.ui.showError('No step data available');
      return;
    }
    
    const currentStepData = stepData.steps[this.currentStepIndex];
    
    console.log('Demonstrating step:', currentStepData);
    
    this.websocket.emit('learning_step', {
      step: this.currentStep,
      index: this.currentStepIndex
    });
    
    this.ui.updateCubeInfo(`Demonstrating: ${currentStepData.description}`);
    this.ui.showNotification('Demonstration started', 'info');
  }
  
  practiceStep() {
    const stepData = this.cfopSteps[this.currentStep];
    if (!stepData || !stepData.steps[this.currentStepIndex]) {
      this.ui.showError('No step data available');
      return;
    }
    
    const currentStepData = stepData.steps[this.currentStepIndex];
    const moves = currentStepData.moves.split(' ');
    
    console.log('Practice mode for:', currentStepData);
    
    this.ui.updateCubeInfo(`Practice: ${currentStepData.description}`);
    this.ui.showNotification('Practice mode - use manual controls', 'info');
    
    // Highlight the algorithm moves
    const algorithmElement = document.getElementById('algorithmMoves');
    if (algorithmElement) {
      algorithmElement.style.animation = 'pulse 2s infinite';
      setTimeout(() => {
        algorithmElement.style.animation = '';
      }, 4000);
    }
  }
  
  updateStepDisplay() {
    if (!this.cfopSteps[this.currentStep]) return;
    
    const stepData = this.cfopSteps[this.currentStep];
    const currentStepData = stepData.steps[this.currentStepIndex];
    
    // Update step info
    this.ui.updateLearningStep({
      step: this.currentStep,
      name: stepData.name,
      description: stepData.description,
      moves: currentStepData ? currentStepData.moves : ''
    });
    
    // Update navigation
    this.ui.updateStepNavigation(this.currentStepIndex, stepData.steps.length);
    
    // Update step description with current sub-step
    const stepDescElement = document.getElementById('stepDescription');
    if (stepDescElement && currentStepData) {
      stepDescElement.textContent = currentStepData.description;
    }
  }
  
  handleLearningStepStarted(data) {
    if (!this.isActive) return;
    
    console.log('Learning step started:', data);
    
    // Execute moves with animation
    if (data.moves && Array.isArray(data.moves)) {
      data.moves.forEach((move, index) => {
        setTimeout(() => {
          this.cubeRenderer.executeMove(move);
          
          if (index === data.moves.length - 1) {
            this.ui.updateCubeInfo('Demonstration complete');
          }
        }, index * 800); // 800ms delay between moves for learning
      });
    }
    
    this.ui.showNotification(`Demonstrating: ${data.description}`, 'info');
  }
  
  updateProgress(progress) {
    if (!this.isActive) return;
    
    // Update learning progress if needed
    if (progress.current_step && progress.current_step !== this.currentStep) {
      this.selectStep(progress.current_step);
    }
    
    if (progress.step_index !== undefined && progress.step_index !== this.currentStepIndex) {
      this.currentStepIndex = progress.step_index;
      this.updateStepDisplay();
    }
  }
  
  // Helper method to get step color for UI
  getStepColor(stepName) {
    const colors = {
      cross: '#10b981',    // Green
      f2l: '#3b82f6',      // Blue
      oll: '#f59e0b',      // Yellow
      pll: '#ef4444'       // Red
    };
    return colors[stepName] || '#6b7280';
  }
}
