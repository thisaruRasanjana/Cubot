// 3D Cube Renderer using Three.js
export class CubeRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cube = null;
    this.cubelets = [];
    this.animationQueue = [];
    this.isAnimating = false;
    this.mode = 'solving'; // 'solving' or 'learning'
    
    // Cube colors
    this.colors = {
      U: 0xffffff, // White (Up)
      D: 0xffff00, // Yellow (Down)
      F: 0x00ff00, // Green (Front)
      B: 0x0000ff, // Blue (Back)
      R: 0xff0000, // Red (Right)
      L: 0xff8000  // Orange (Left)
    };
  }
  
  async init() {
    this.setupScene();
    this.createCube();
    this.setupLighting();
    this.setupControls();
    this.startRenderLoop();
    this.handleResize();
  }
  
  setupScene() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(4, 4, 4);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  
  createCube() {
    this.cube = new THREE.Group();
    this.cubelets = [];
    
    const cubeletSize = 0.95;
    const gap = 0.05;
    
    // Create 3x3x3 cube
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const cubelet = this.createCubelet(cubeletSize);
          cubelet.position.set(
            x * (cubeletSize + gap),
            y * (cubeletSize + gap),
            z * (cubeletSize + gap)
          );
          
          // Store position for move calculations
          cubelet.userData = { x, y, z };
          
          this.cube.add(cubelet);
          this.cubelets.push(cubelet);
        }
      }
    }
    
    this.scene.add(this.cube);
  }
  
  createCubelet(size) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    
    // Create materials for each face
    const materials = [
      new THREE.MeshLambertMaterial({ color: this.colors.R }), // Right
      new THREE.MeshLambertMaterial({ color: this.colors.L }), // Left
      new THREE.MeshLambertMaterial({ color: this.colors.U }), // Top
      new THREE.MeshLambertMaterial({ color: this.colors.D }), // Bottom
      new THREE.MeshLambertMaterial({ color: this.colors.F }), // Front
      new THREE.MeshLambertMaterial({ color: this.colors.B })  // Back
    ];
    
    const cubelet = new THREE.Mesh(geometry, materials);
    cubelet.castShadow = true;
    cubelet.receiveShadow = true;
    
    // Add black edges
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    cubelet.add(edgeLines);
    
    return cubelet;
  }
  
  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    
    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    // Point light for better illumination
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-5, 5, 5);
    this.scene.add(pointLight);
  }
  
  setupControls() {
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    // Helper function to convert degrees to radians
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    
    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (!isDragging || this.mode === 'solving') return;
      
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };
      
      const deltaRotationQuaternion = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(
          toRadians(deltaMove.y * 0.5),
          toRadians(deltaMove.x * 0.5),
          0,
          'XYZ'
        ));
      
      this.cube.quaternion.multiplyQuaternions(deltaRotationQuaternion, this.cube.quaternion);
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    // Touch controls for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      }
    });
    
    this.canvas.addEventListener('touchmove', (e) => {
      if (!isDragging || this.mode === 'solving' || e.touches.length !== 1) return;
      
      e.preventDefault();
      const deltaMove = {
        x: e.touches[0].clientX - previousMousePosition.x,
        y: e.touches[0].clientY - previousMousePosition.y
      };
      
      const deltaRotationQuaternion = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(
          toRadians(deltaMove.y * 0.5),
          toRadians(deltaMove.x * 0.5),
          0,
          'XYZ'
        ));
      
      this.cube.quaternion.multiplyQuaternions(deltaRotationQuaternion, this.cube.quaternion);
      previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    });
    
    this.canvas.addEventListener('touchend', () => {
      isDragging = false;
    });
    
    // Zoom with mouse wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoom = e.deltaY * 0.01;
      this.camera.position.multiplyScalar(1 + zoom);
      this.camera.position.clampLength(2, 10);
    });
  }
  
  startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Auto-rotate in solving mode when not animating
      if (this.mode === 'solving' && !this.isAnimating) {
        this.cube.rotation.y += 0.005;
      }
      
      this.renderer.render(this.scene, this.camera);
    };
    
    animate();
  }
  
  executeMove(move) {
    if (this.mode === 'learning') {
      this.animateMove(move);
    } else {
      // In solving mode, just update the visual state
      this.updateCubeState(move);
    }
  }
  
  animateMove(move) {
    if (this.isAnimating) {
      this.animationQueue.push(move);
      return;
    }
    
    this.isAnimating = true;
    
    const axis = this.getMoveAxis(move);
    const angle = this.getMoveAngle(move);
    const layer = this.getMoveLayer(move);
    
    const cubeletsToRotate = this.cubelets.filter(cubelet => {
      return this.isCubeletInLayer(cubelet, axis, layer);
    });
    
    // Create rotation group
    const rotationGroup = new THREE.Group();
    this.scene.add(rotationGroup);
    
    // Move cubelets to rotation group
    cubeletsToRotate.forEach(cubelet => {
      const worldPosition = new THREE.Vector3();
      cubelet.getWorldPosition(worldPosition);
      this.cube.remove(cubelet);
      rotationGroup.add(cubelet);
      cubelet.position.copy(worldPosition);
    });
    
    // Animate rotation
    const startRotation = rotationGroup.rotation[axis];
    const targetRotation = startRotation + angle;
    const duration = 500; // ms
    const startTime = Date.now();
    
    const animateRotation = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      rotationGroup.rotation[axis] = startRotation + (targetRotation - startRotation) * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animateRotation);
      } else {
        // Animation complete - move cubelets back to cube
        cubeletsToRotate.forEach(cubelet => {
          const worldPosition = new THREE.Vector3();
          cubelet.getWorldPosition(worldPosition);
          rotationGroup.remove(cubelet);
          this.cube.add(cubelet);
          cubelet.position.copy(worldPosition);
          
          // Update cubelet's userData position
          this.updateCubeletPosition(cubelet, axis, angle);
        });
        
        this.scene.remove(rotationGroup);
        this.isAnimating = false;
        
        // Process next animation in queue
        if (this.animationQueue.length > 0) {
          const nextMove = this.animationQueue.shift();
          this.animateMove(nextMove);
        }
      }
    };
    
    animateRotation();
  }
  
  getMoveAxis(move) {
    const face = move.charAt(0);
    switch (face) {
      case 'U':
      case 'D':
        return 'y';
      case 'R':
      case 'L':
        return 'x';
      case 'F':
      case 'B':
        return 'z';
      default:
        return 'y';
    }
  }
  
  getMoveAngle(move) {
    const isPrime = move.includes("'");
    const isDouble = move.includes('2');
    
    let angle = Math.PI / 2; // 90 degrees
    
    if (isDouble) {
      angle = Math.PI; // 180 degrees
    } else if (isPrime) {
      angle = -Math.PI / 2; // -90 degrees
    }
    
    // Adjust for face direction
    const face = move.charAt(0);
    if (face === 'D' || face === 'L' || face === 'B') {
      angle = -angle;
    }
    
    return angle;
  }
  
  getMoveLayer(move) {
    const face = move.charAt(0);
    switch (face) {
      case 'U': return 1;
      case 'D': return -1;
      case 'R': return 1;
      case 'L': return -1;
      case 'F': return 1;
      case 'B': return -1;
      default: return 0;
    }
  }
  
  isCubeletInLayer(cubelet, axis, layer) {
    const position = cubelet.userData;
    switch (axis) {
      case 'y': return position.y === layer;
      case 'x': return position.x === layer;
      case 'z': return position.z === layer;
      default: return false;
    }
  }
  
  updateCubeletPosition(cubelet, axis, angle) {
    const pos = cubelet.userData;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    let newX = pos.x, newY = pos.y, newZ = pos.z;
    
    switch (axis) {
      case 'y': // Y-axis rotation
        newX = Math.round(pos.x * cos - pos.z * sin);
        newZ = Math.round(pos.x * sin + pos.z * cos);
        break;
      case 'x': // X-axis rotation
        newY = Math.round(pos.y * cos - pos.z * sin);
        newZ = Math.round(pos.y * sin + pos.z * cos);
        break;
      case 'z': // Z-axis rotation
        newX = Math.round(pos.x * cos - pos.y * sin);
        newY = Math.round(pos.x * sin + pos.y * cos);
        break;
    }
    
    cubelet.userData = { x: newX, y: newY, z: newZ };
  }
  
  updateCubeState(move) {
    // Simple visual update without animation
    // This would update the cube's internal state representation
    console.log(`Executing move: ${move}`);
  }
  
  setMode(mode) {
    this.mode = mode;
    
    if (mode === 'solving') {
      // Reset cube rotation for solving mode
      this.cube.rotation.set(0, 0, 0);
    }
  }
  
  handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
