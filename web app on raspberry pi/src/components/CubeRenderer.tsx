import React, { useEffect, useRef } from 'react';

interface CubeRendererProps {
  mode: 'solving' | 'learning';
}

const CubeRenderer: React.FC<CubeRendererProps> = ({ mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const cubeRef = useRef<any>(null);
  const animationIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Three.js scene
    const scene = new (window as any).THREE.Scene();
    scene.background = new (window as any).THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera
    const camera = new (window as any).THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new (window as any).THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = (window as any).THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Create cube
    const cubeGroup = new (window as any).THREE.Group();
    const cubeletSize = 0.95;
    const gap = 0.05;

    // Cube colors
    const colors = {
      U: 0xffffff, // White (Up)
      D: 0xffff00, // Yellow (Down)
      F: 0x00ff00, // Green (Front)
      B: 0x0000ff, // Blue (Back)
      R: 0xff0000, // Red (Right)
      L: 0xff8000  // Orange (Left)
    };

    // Create 3x3x3 cube
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const geometry = new (window as any).THREE.BoxGeometry(cubeletSize, cubeletSize, cubeletSize);
          
          // Create materials for each face
          const materials = [
            new (window as any).THREE.MeshLambertMaterial({ color: colors.R }), // Right
            new (window as any).THREE.MeshLambertMaterial({ color: colors.L }), // Left
            new (window as any).THREE.MeshLambertMaterial({ color: colors.U }), // Top
            new (window as any).THREE.MeshLambertMaterial({ color: colors.D }), // Bottom
            new (window as any).THREE.MeshLambertMaterial({ color: colors.F }), // Front
            new (window as any).THREE.MeshLambertMaterial({ color: colors.B })  // Back
          ];

          const cubelet = new (window as any).THREE.Mesh(geometry, materials);
          cubelet.position.set(
            x * (cubeletSize + gap),
            y * (cubeletSize + gap),
            z * (cubeletSize + gap)
          );
          cubelet.castShadow = true;
          cubelet.receiveShadow = true;

          // Add black edges
          const edges = new (window as any).THREE.EdgesGeometry(geometry);
          const edgeMaterial = new (window as any).THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
          const edgeLines = new (window as any).THREE.LineSegments(edges, edgeMaterial);
          cubelet.add(edgeLines);

          cubeGroup.add(cubelet);
        }
      }
    }

    scene.add(cubeGroup);
    cubeRef.current = cubeGroup;

    // Lighting
    const ambientLight = new (window as any).THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new (window as any).THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight = new (window as any).THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      // Auto-rotate in solving mode
      if (mode === 'solving') {
        cubeGroup.rotation.y += 0.005;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    // Mouse controls for learning mode
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      if (mode === 'learning') {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || mode !== 'learning') return;
      
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };
      
      const deltaRotationQuaternion = new (window as any).THREE.Quaternion()
        .setFromEuler(new (window as any).THREE.Euler(
          (deltaMove.y * 0.5) * (Math.PI / 180),
          (deltaMove.x * 0.5) * (Math.PI / 180),
          0,
          'XYZ'
        ));
      
      cubeGroup.quaternion.multiplyQuaternions(deltaRotationQuaternion, cubeGroup.quaternion);
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    canvasRef.current.addEventListener('mousedown', handleMouseDown);
    canvasRef.current.addEventListener('mousemove', handleMouseMove);
    canvasRef.current.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousedown', handleMouseDown);
        canvasRef.current.removeEventListener('mousemove', handleMouseMove);
        canvasRef.current.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [mode]);

  return (
    <div className="relative w-full aspect-square">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-xl"
        style={{ display: 'block' }}
      />
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-lg text-sm">
        Ready
      </div>
    </div>
  );
};

export default CubeRenderer;
