import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CubeProps {
  position: [number, number, number];
  colors: string[];
}

// Animation speed and smoothness configuration
const ANIMATION_SPEED = 0.025; // Slightly faster animation
const ROTATION_SNAP_THRESHOLD = 0.95; // Later snap for smoother completion

// Track the current move state
interface MoveState {
  move: string;
  startQuaternions: THREE.Quaternion[];
  targetQuaternions: THREE.Quaternion[];
  startPositions: [number, number, number][];
  targetPositions: [number, number, number][];
  affectedCubes: number[];
  progress: number;
  isDemo: boolean;
  // For double moves
  isDoubleMove: boolean;
  doubleMovePart: 1 | 2;
}

const SmallCube: React.FC<CubeProps> = ({ position, colors }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  return (
    <mesh ref={meshRef} position={position} castShadow receiveShadow>
      <boxGeometry args={[0.95, 0.95, 0.95]} />
      {colors.map((color, index) => (
        <meshStandardMaterial 
          key={`${position.join('-')}-${index}`}
          attach={`material-${index}`} 
          color={color}
          roughness={0.3}
          metalness={0.15}
          flatShading={false}
          transparent={false}
          opacity={1}
          emissive={color}
          emissiveIntensity={0.05}
        />
      ))}
      <EdgesGeometry />
    </mesh>
  );
};

// Separate component for cube edges
const EdgesGeometry: React.FC = () => (
  <lineSegments>
    <edgesGeometry args={[new THREE.BoxGeometry(0.96, 0.96, 0.96)]} />
    <lineBasicMaterial color="black" linewidth={2} />
  </lineSegments>
);

interface CubeState {
  positions: [number, number, number][];
  colors: string[][];
}

interface RubiksCube3DProps {
  currentMove?: string;
  onMoveComplete?: () => void;
  initialState?: CubeState;
  isReverse?: boolean;
}

const CubeScene: React.FC<{ 
  cubeState: React.MutableRefObject<CubeState>;
  groupRef: React.RefObject<THREE.Group>;
  currentMove?: string;
  onMoveComplete?: () => void;
  initialState?: CubeState;
  isDemoMode?: boolean;
  isReverse?: boolean;
}> = ({
  cubeState,
  groupRef,
  currentMove,
  onMoveComplete,
  initialState,
  isDemoMode = false,
  isReverse = false
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const moveStateRef = useRef<MoveState | null>(null);
  const demoStateRef = useRef<{
    originalPositions: [number, number, number][];
    originalQuaternions: THREE.Quaternion[];
  } | null>(null);

  // Initialize cube state from props if provided
  useEffect(() => {
    if (initialState) {
      cubeState.current = {
        positions: [...initialState.positions],
        colors: [...initialState.colors]
      };
    }
  }, [initialState]);

  // Save original state for demo mode
  const saveOriginalState = () => {
    if (!groupRef.current) return;

    const originalPositions: [number, number, number][] = [];
    const originalQuaternions: THREE.Quaternion[] = [];

    cubeState.current.positions.forEach((pos, index) => {
      const cube = groupRef.current!.children[index] as THREE.Mesh;
      originalPositions.push([...pos]);
      originalQuaternions.push(cube.quaternion.clone());
    });

    demoStateRef.current = {
      originalPositions,
      originalQuaternions
    };
  };

  // Restore original state for demo mode
  const restoreOriginalState = () => {
    if (!groupRef.current || !demoStateRef.current) return;

    const { originalPositions, originalQuaternions } = demoStateRef.current;

    cubeState.current.positions.forEach((_, index) => {
      const cube = groupRef.current!.children[index] as THREE.Mesh;
      cube.position.set(...originalPositions[index]);
      cube.quaternion.copy(originalQuaternions[index]);
      cubeState.current.positions[index] = [...originalPositions[index]];
    });
  };

  // Start new move
  useEffect(() => {
    if (!currentMove || !groupRef.current || isAnimating) return;

    try {
      // Save original state if entering demo mode
      if (isDemoMode && !demoStateRef.current) {
        saveOriginalState();
      }

      // Parse move notation
      let moveToExecute = currentMove;
      
      // If this is a reverse move, convert it
      if (isReverse) {
        if (moveToExecute.includes("'")) {
          moveToExecute = moveToExecute.replace("'", "");
        } else if (moveToExecute.includes("2")) {
          // Double moves remain the same when reversed
        } else {
          moveToExecute = moveToExecute + "'";
        }
        console.log(`Executing reverse move: ${currentMove} -> ${moveToExecute}`);
      } else {
        console.log(`Executing move: ${moveToExecute}`);
      }
      
      const isCounterClockwise = moveToExecute.includes("'");
      const isTwice = moveToExecute.includes("2");
      const face = moveToExecute[0];

      // For double moves, we'll do two 90-degree rotations instead of one 180-degree rotation
      // So we'll use 90 degrees (PI/2) for all moves, and handle the second part in the animation frame
      const angle = (Math.PI / 2) * (isCounterClockwise ? 1 : -1);

      // Define rotation axis
      const axis = new THREE.Vector3();
      switch (face) {
        case 'R': axis.set(1, 0, 0); break;
        case 'L': axis.set(-1, 0, 0); break;
        case 'U': axis.set(0, 1, 0); break;
        case 'D': axis.set(0, -1, 0); break;
        case 'F': axis.set(0, 0, 1); break;
        case 'B': axis.set(0, 0, -1); break;
        default: return;
      }

      // Create rotation matrix
      const rotationMatrix = new THREE.Matrix4();
      rotationMatrix.makeRotationAxis(axis.normalize(), angle);

      // Find affected cubes
      const affectedCubes: number[] = [];
      const startPositions: [number, number, number][] = [];
      const targetPositions: [number, number, number][] = [];
      const startQuaternions: THREE.Quaternion[] = [];
      const targetQuaternions: THREE.Quaternion[] = [];

      // Helper function to check if a cube is affected by the move
      const isAffectedByMove = (pos: [number, number, number], face: string): boolean => {
        const [x, y, z] = pos;
        const tolerance = 0.1;
        switch (face) {
          case 'R': return Math.abs(x - 1) < tolerance;
          case 'L': return Math.abs(x + 1) < tolerance;
          case 'U': return Math.abs(y - 1) < tolerance;
          case 'D': return Math.abs(y + 1) < tolerance;
          case 'F': return Math.abs(z - 1) < tolerance;
          case 'B': return Math.abs(z + 1) < tolerance;
          default: return false;
        }
      };

      cubeState.current.positions.forEach((pos, index) => {
        if (isAffectedByMove(pos, face)) {
          const cube = groupRef.current!.children[index] as THREE.Mesh;
          affectedCubes.push(index);
          
          // Store start position and calculate target position
          startPositions.push([...pos]);
          const targetPos = new THREE.Vector3(...pos).applyMatrix4(rotationMatrix);
          targetPositions.push([
            Math.round(targetPos.x),
            Math.round(targetPos.y),
            Math.round(targetPos.z)
          ]);
          
          // Store start quaternion and calculate target quaternion
          const startQuat = cube.quaternion.clone();
          startQuaternions.push(startQuat);
          
          const targetQuat = startQuat.clone();
          targetQuat.premultiply(new THREE.Quaternion().setFromRotationMatrix(rotationMatrix));
          targetQuaternions.push(targetQuat);
        }
      });

      // Only start animation if there are affected cubes
      if (affectedCubes.length > 0) {
        moveStateRef.current = {
          move: moveToExecute,
          startQuaternions,
          targetQuaternions,
          startPositions,
          targetPositions,
          affectedCubes,
          progress: 0,
          isDemo: isDemoMode,
          isDoubleMove: isTwice,
          doubleMovePart: 1
        };
        setIsAnimating(true);
      } else {
        console.warn(`No cubes affected by move: ${moveToExecute}`);
        onMoveComplete?.();
      }
    } catch (err) {
      console.error('Error starting move:', err);
      onMoveComplete?.();
    }
  }, [currentMove, isAnimating, isDemoMode, isReverse]);

  // Handle animation frame
  useFrame(() => {
    if (!groupRef.current || !isAnimating || !moveStateRef.current) return;

    try {
      const { 
        move,
        startQuaternions,
        targetQuaternions,
        startPositions,
        targetPositions,
        affectedCubes,
        progress,
        isDemo,
        isDoubleMove,
        doubleMovePart
      } = moveStateRef.current;
      
      // Standard easing for all moves
      const t = 1 - Math.pow(1 - progress, 3);
      
      // Apply rotation to affected cubes
      affectedCubes.forEach((index, i) => {
        const cube = groupRef.current!.children[index] as THREE.Mesh;
        if (cube) {
          // Position interpolation
          const startPos = new THREE.Vector3(...startPositions[i]);
          const targetPos = new THREE.Vector3(...targetPositions[i]);
          cube.position.lerpVectors(startPos, targetPos, t);

          // Rotation interpolation with quaternions
          const currentQuat = new THREE.Quaternion();
          currentQuat.slerpQuaternions(
            startQuaternions[i],
            targetQuaternions[i],
            t
          );
          cube.quaternion.copy(currentQuat);

          // Snap to final position when close enough
          if (t > ROTATION_SNAP_THRESHOLD) {
            cube.position.copy(targetPos);
            cube.quaternion.copy(targetQuaternions[i]);
          }
        }
      });

      // Update progress
      moveStateRef.current.progress += ANIMATION_SPEED;

      // Animation complete
      if (moveStateRef.current.progress >= 1) {
        // Update cube state with final positions
        affectedCubes.forEach((index, i) => {
          // Update the cube state with the final positions
          cubeState.current.positions[index] = [...targetPositions[i]];
          
          // Update the cube mesh position and rotation
          const cube = groupRef.current!.children[index] as THREE.Mesh;
          cube.position.set(...targetPositions[i]);
          cube.quaternion.copy(targetQuaternions[i]);
          
          // Log the update for debugging
          console.log(`Updated cube ${index} to position [${targetPositions[i]}]`);
        });

        // For double moves, we need to do a second 90-degree rotation
        if (isDoubleMove && doubleMovePart === 1 && !isDemo) {
          console.log("Starting second part of double move");
          
          // Extract the face and direction from the move
          const face = move[0];
          const isCounterClockwise = move.includes("'");
          
          // Calculate the rotation angle for the second part (same as first)
          const angle = (Math.PI / 2) * (isCounterClockwise ? 1 : -1);
          
          // Define rotation axis
          const axis = new THREE.Vector3();
          switch (face) {
            case 'R': axis.set(1, 0, 0); break;
            case 'L': axis.set(-1, 0, 0); break;
            case 'U': axis.set(0, 1, 0); break;
            case 'D': axis.set(0, -1, 0); break;
            case 'F': axis.set(0, 0, 1); break;
            case 'B': axis.set(0, 0, -1); break;
            default: break;
          }
          
          // Create rotation matrix for second part
          const rotationMatrix = new THREE.Matrix4();
          rotationMatrix.makeRotationAxis(axis.normalize(), angle);
          
          // Store current state as start state for second part
          const newStartPositions: [number, number, number][] = [];
          const newTargetPositions: [number, number, number][] = [];
          const newStartQuaternions: THREE.Quaternion[] = [];
          const newTargetQuaternions: THREE.Quaternion[] = [];
          
          // Calculate new target positions and quaternions
          affectedCubes.forEach((index, i) => {
            const cube = groupRef.current!.children[index] as THREE.Mesh;
            
            // Store current position as start position
            const currentPos = [...cubeState.current.positions[index]] as [number, number, number];
            newStartPositions.push(currentPos);
            
            // Calculate new target position
            const targetPos = new THREE.Vector3(...currentPos).applyMatrix4(rotationMatrix);
            newTargetPositions.push([
              Math.round(targetPos.x),
              Math.round(targetPos.y),
              Math.round(targetPos.z)
            ]);
            
            // Store current quaternion as start quaternion
            const currentQuat = cube.quaternion.clone();
            newStartQuaternions.push(currentQuat);
            
            // Calculate new target quaternion
            const targetQuat = currentQuat.clone();
            targetQuat.premultiply(new THREE.Quaternion().setFromRotationMatrix(rotationMatrix));
            newTargetQuaternions.push(targetQuat);
          });
          
          // Update move state for second part
          moveStateRef.current = {
            move,
            startQuaternions: newStartQuaternions,
            targetQuaternions: newTargetQuaternions,
            startPositions: newStartPositions,
            targetPositions: newTargetPositions,
            affectedCubes,
            progress: 0,
            isDemo,
            isDoubleMove,
            doubleMovePart: 2
          };
        } else {
          // In demo mode, reset to original state and repeat
          if (isDemo) {
            restoreOriginalState();
            moveStateRef.current.progress = 0;
          } else {
            // Reset move state
            moveStateRef.current = null;
            setIsAnimating(false);
            onMoveComplete?.();
          }
        }
      } else if (moveStateRef.current.progress >= 0.9 && !isDemo && !isDoubleMove) {
        // Allow UI controls to become responsive earlier for single moves
        // but not for double moves (we need to complete both parts first)
        onMoveComplete?.();
      }
    } catch (err) {
      console.error('Error in animation frame:', err);
      moveStateRef.current = null;
      setIsAnimating(false);
      onMoveComplete?.();
    }
  });

  // Cleanup demo state when unmounting or changing moves
  useEffect(() => {
    return () => {
      demoStateRef.current = null;
    };
  }, [currentMove]);

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[10, 10, 10]} intensity={1.2} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.8} />
      <pointLight position={[0, 15, 0]} intensity={0.6} />
      <group ref={groupRef}>
        {cubeState.current.positions.map((position: [number, number, number], index: number) => (
          <SmallCube
            key={index}
            position={position}
            colors={cubeState.current.colors[index]}
          />
        ))}
      </group>
      <OrbitControls 
        enableZoom={true} 
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.8}
        zoomSpeed={0.6}
        autoRotate={false}
        autoRotateSpeed={0.5}
        enableRotate={true}
        maxPolarAngle={Math.PI}
        minPolarAngle={0}
      />
    </>
  );
};

const RubiksCube3D: React.FC<RubiksCube3DProps> = ({ currentMove, onMoveComplete, initialState, isReverse }) => {
  const groupRef = useRef<THREE.Group>(null!) as React.MutableRefObject<THREE.Group>;
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cubeState = useRef<CubeState>({
    positions: [],
    colors: []
  });

  // Initialize cube state
  useEffect(() => {
    try {
      if (initialState) {
        cubeState.current = {
          positions: [...initialState.positions],
          colors: [...initialState.colors]
        };
        setIsInitialized(true);
        return;
      }

      const positions: [number, number, number][] = [];
      const colors: string[][] = [];

      // Generate positions and colors for all cubes
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            positions.push([x, y, z]);
            
            // High contrast Rubik's cube colors for easy identification
            const cubeColors = [
              x === 1 ? '#e60000' : '#2a2a2a',  // Right - Bright Red, inner faces dark
              x === -1 ? '#cc00ff' : '#2a2a2a', // Left - Bright Magenta/Purple, inner faces dark
              y === 1 ? '#ffffff' : '#2a2a2a',  // Top - White, inner faces dark
              y === -1 ? '#ffdd00' : '#2a2a2a', // Bottom - Bright Yellow, inner faces dark
              z === 1 ? '#00cc00' : '#2a2a2a',  // Front - Bright Green, inner faces dark
              z === -1 ? '#0066ff' : '#2a2a2a'  // Back - Bright Blue, inner faces dark
            ];
            colors.push(cubeColors);
          }
        }
      }

      cubeState.current = { positions, colors };
      setIsInitialized(true);
    } catch (err) {
      console.error('Error initializing cube state:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize cube');
    }
  }, [initialState]);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-red-100/10 backdrop-blur-sm rounded-xl">
        <p className="text-red-500 font-medium">Error: {error}</p>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-xl">
        <p className="text-white">Initializing cube...</p>
      </div>
    );
  }

  return (
    <Canvas 
      camera={{ position: [4, 4, 4], fov: 50 }}
      shadows
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <CubeScene
          cubeState={cubeState}
          groupRef={groupRef}
          currentMove={currentMove}
          onMoveComplete={onMoveComplete}
          initialState={initialState}
          isDemoMode={false}
          isReverse={isReverse}
        />
      </Suspense>
    </Canvas>
  );
};

export default RubiksCube3D; 