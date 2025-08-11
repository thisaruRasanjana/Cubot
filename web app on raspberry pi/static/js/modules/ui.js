// UI Manager for CUBOT
export class UIManager {
  constructor() {
    this.elements = this.getElements();
    this.currentMode = 'solving';
    this.setupEventListeners();
  }
  
  getElements() {
    return {
      // Connection status
      connectionStatus: document.getElementById('connectionStatus'),
      statusDot: document.querySelector('.status-dot'),
      statusText: document.querySelector('.status-text'),
      
      // Mode tabs
      tabButtons: document.querySelectorAll('.tab-button'),
      modeContents: document.querySelectorAll('.mode-content'),
      
      // Solving mode elements
      moveCount: document.getElementById('moveCount'),
      elapsedTime: document.getElementById('elapsedTime'),
      progressPercent: document.getElementById('progressPercent'),
      progressFill: document.getElementById('progressFill'),
      currentMove: document.getElementById('currentMove'),
      cubeInfo: document.getElementById('cubeInfo'),
      
      // Learning mode elements
      stepButtons: document.querySelectorAll('.step-btn'),
      stepTitle: document.getElementById('stepTitle'),
      stepDescription: document.getElementById('stepDescription'),
      stepCounter: document.getElementById('stepCounter'),
      algorithmMoves: document.getElementById('algorithmMoves'),
      prevStep: document.getElementById('prevStep'),
      nextStep: document.getElementById('nextStep')
    };
  }
  
  setupEventListeners() {
    // Tab switching
    this.elements.tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.switchMode(mode);
      });
    });
  }
  
  updateConnectionStatus(isConnected) {
    if (isConnected) {
      this.elements.statusDot.classList.add('connected');
      this.elements.statusText.textContent = 'Connected';
    } else {
      this.elements.statusDot.classList.remove('connected');
      this.elements.statusText.textContent = 'Disconnected';
    }
  }
  
  switchMode(mode) {
    this.currentMode = mode;
    
    // Update tab buttons
    this.elements.tabButtons.forEach(button => {
      if (button.dataset.mode === mode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Update mode content
    this.elements.modeContents.forEach(content => {
      if (content.id === `${mode}Mode`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }
  
  updateSolvingProgress(progress) {
    if (this.elements.moveCount) {
      this.elements.moveCount.textContent = progress.current_step || 0;
    }
    
    if (this.elements.elapsedTime && progress.elapsed_time) {
      const minutes = Math.floor(progress.elapsed_time / 60);
      const seconds = Math.floor(progress.elapsed_time % 60);
      this.elements.elapsedTime.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (this.elements.progressPercent && progress.progress_percent !== undefined) {
      this.elements.progressPercent.textContent = `${Math.round(progress.progress_percent)}%`;
    }
    
    if (this.elements.progressFill && progress.progress_percent !== undefined) {
      this.elements.progressFill.style.width = `${progress.progress_percent}%`;
    }
    
    if (this.elements.currentMove && progress.current_move) {
      this.elements.currentMove.textContent = `Current move: ${progress.current_move}`;
    }
  }
  
  updateCubeInfo(message) {
    if (this.elements.cubeInfo) {
      this.elements.cubeInfo.querySelector('span').textContent = message;
    }
  }
  
  showMoveExecuted(move) {
    this.updateCubeInfo(`Executed: ${move}`);
    
    // Clear message after 2 seconds
    setTimeout(() => {
      this.updateCubeInfo('Ready');
    }, 2000);
  }
  
  showSerialFeedback(data) {
    console.log('Serial feedback:', data);
    
    if (data.status === 'move_complete') {
      this.updateCubeInfo(`Completed: ${data.move || 'Move'}`);
    } else if (data.status === 'error') {
      this.showError(data.message || 'Serial communication error');
    }
  }
  
  showError(message) {
    console.error('Error:', message);
    this.updateCubeInfo(`Error: ${message}`);
    
    // Clear error after 5 seconds
    setTimeout(() => {
      this.updateCubeInfo('Ready');
    }, 5000);
  }
  
  updateLearningStep(stepData) {
    if (this.elements.stepTitle) {
      this.elements.stepTitle.textContent = stepData.name || stepData.step;
    }
    
    if (this.elements.stepDescription) {
      this.elements.stepDescription.textContent = stepData.description || '';
    }
    
    if (this.elements.algorithmMoves) {
      this.elements.algorithmMoves.textContent = stepData.moves || '';
    }
    
    // Update step buttons
    this.elements.stepButtons.forEach(button => {
      if (button.dataset.step === stepData.step) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }
  
  updateStepNavigation(currentIndex, totalSteps) {
    if (this.elements.stepCounter) {
      this.elements.stepCounter.textContent = `${currentIndex + 1} / ${totalSteps}`;
    }
    
    if (this.elements.prevStep) {
      this.elements.prevStep.disabled = currentIndex === 0;
    }
    
    if (this.elements.nextStep) {
      this.elements.nextStep.disabled = currentIndex === totalSteps - 1;
    }
  }
  
  setButtonState(buttonId, enabled) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = !enabled;
    }
  }
  
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '500',
      zIndex: '1000',
      opacity: '0',
      transform: 'translateY(-20px)',
      transition: 'all 0.3s ease'
    });
    
    // Set background color based on type
    switch (type) {
      case 'success':
        notification.style.background = '#10b981';
        break;
      case 'error':
        notification.style.background = '#ef4444';
        break;
      case 'warning':
        notification.style.background = '#f59e0b';
        break;
      default:
        notification.style.background = '#3b82f6';
    }
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-20px)';
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}
