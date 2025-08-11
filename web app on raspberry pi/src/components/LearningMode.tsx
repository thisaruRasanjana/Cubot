import React, { useState, useEffect, useRef } from 'react';
import RubiksCube3D from './RubiksCube3D';
import { apiClient } from '../lib/api';

interface LearningModeProps {
  cfopSteps?: any;
  learningProgress?: any;
  scannedFaces?: Record<string, string>;
  onStartScanning?: () => void;
}

interface CubeState {
  positions: [number, number, number][];
  colors: string[][];
}

// Move descriptions for better understanding
const getMoveDescription = (move: string): string => {
  const face = move[0];
  const isCounterClockwise = move.includes("'");
  const isTwice = move.includes("2");

  const faceDescriptions: Record<string, string> = {
    R: "right face (red)",
    L: "left face (orange)",
    U: "top face (white)",
    D: "bottom face (yellow)",
    F: "front face (green)",
    B: "back face (blue)"
  };

  const directionDescription = isTwice 
    ? "180 degrees (half turn)" 
    : isCounterClockwise 
      ? "90 degrees counterclockwise" 
      : "90 degrees clockwise";

  return `Watch the ${faceDescriptions[face]} rotate ${directionDescription}`;
};

// Get a more detailed explanation of the move
const getMoveExplanation = (move: string): string => {
  const face = move[0];
  const isCounterClockwise = move.includes("'");
  const isTwice = move.includes("2");

  const faceDescriptions: Record<string, string> = {
    R: "Right Face (Red)",
    L: "Left Face (Orange)", 
    U: "Top Face (White)",
    D: "Bottom Face (Yellow)",
    F: "Front Face (Green)",
    B: "Back Face (Blue)"
  };

  const directionExplanation = isTwice 
    ? "180° (half turn)" 
    : isCounterClockwise 
      ? "90° counterclockwise" 
      : "90° clockwise";

  return `${faceDescriptions[face]} - ${directionExplanation}`;
};

// Get a beginner-friendly explanation of the move
const getBeginnerMoveExplanation = (move: string): string => {
  const face = move[0];
  const isCounterClockwise = move.includes("'");
  const isTwice = move.includes("2");

  const faceInstructions: Record<string, string> = {
    R: "Turn the right side (red)",
    L: "Turn the left side (purple)",
    U: "Turn the top side (white)", 
    D: "Turn the bottom side (yellow)",
    F: "Turn the front side (green)",
    B: "Turn the back side (blue)"
  };

  const directionInstruction = isTwice
    ? "twice (180°)"
    : isCounterClockwise
      ? "counterclockwise (left)"
      : "clockwise (right)";

  return `${faceInstructions[face]} ${directionInstruction}`;
};

const LearningMode: React.FC<LearningModeProps> = ({
  cfopSteps,
  learningProgress,
  scannedFaces,
  onStartScanning
}) => {
  const [selectedStep, setSelectedStep] = useState<string>('cross');
  const [selectedAlgorithmIndex, setSelectedAlgorithmIndex] = useState(0);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cubeKey, setCubeKey] = useState(0);
  const [showMoveExplanation, setShowMoveExplanation] = useState(false);
  const [cubeGripped, setCubeGripped] = useState(false);
  const [isGripping, setIsGripping] = useState(false);

  // Store move history for proper reversal
  const moveHistoryRef = useRef<{move: string, index: number}[]>([]);
  const [currentMoveDescription, setCurrentMoveDescription] = useState<string>("");

  // Store cube state history
  const stateHistoryRef = useRef<CubeState[]>([]);
  const currentStateRef = useRef<CubeState | null>(null);

  // Track if we're currently reversing a move
  const [isReversing, setIsReversing] = useState(false);

  // Queue system for handling rapid button presses during animations
  const moveQueueRef = useRef<('next' | 'prev')[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Handle cube gripping for real-time robot movement visibility
  const handleGripCube = async () => {
    try {
      console.log('[DEBUG] Starting cube gripping process in Learning Mode...');
      setIsGripping(true);
      
      // Send GRIP command to ESP32
      const result = await apiClient.gripCube();
      console.log('[DEBUG] ESP32 grip command result:', result);
      
      if (result.success) {
        console.log('[DEBUG] ESP32 cube gripping successful in Learning Mode');
        setCubeGripped(true);
      } else {
        console.error('[ERROR] Failed to grip cube in Learning Mode:', result);
        // Allow user to try again
      }
    } catch (error) {
      console.error('[ERROR] Exception during cube gripping in Learning Mode:', error);
    } finally {
      setIsGripping(false);
    }
  };

  // Process the next item in the move queue
  const processNextQueuedMove = () => {
    if (isProcessingQueueRef.current || moveQueueRef.current.length === 0 || isAnimating) {
      return;
    }

    isProcessingQueueRef.current = true;
    const nextAction = moveQueueRef.current.shift();
    
    if (nextAction === 'next') {
      executeNextMove();
    } else if (nextAction === 'prev') {
      executePrevMove();
    }
  };

  // Execute next move without queue checks
  const executeNextMove = () => {
    if (!currentStateRef.current) {
      isProcessingQueueRef.current = false;
      return;
    }
    
    // Calculate the next index (either 0 if we're at -1, or currentMoveIndex + 1)
    const nextIndex = currentMoveIndex === -1 ? 0 : currentMoveIndex + 1;
    
    if (nextIndex < currentMoves.length) {
      const nextMove = currentMoves[nextIndex];
      
      console.log(`Next move: ${nextMove}, index: ${nextIndex}`);
      
      // Only send move to ESP32 if cube is gripped (for real-time movement visibility)
      if (cubeGripped) {
        console.log(`[ESP32] Cube is gripped - sending move to robot: ${nextMove}`);
        apiClient.sendMove(nextMove)
          .then(response => {
            if (response.success) {
              console.log(`[ESP32] Move completed successfully: ${nextMove}`);
            } else {
              console.warn(`[ESP32] Move completed with warning: ${response.message}`);
            }
          })
          .catch(error => {
            console.error(`[ESP32] Failed to send move to hardware: ${error}`);
          });
      } else {
        console.log(`[ESP32] Cube not gripped - skipping robot movement, showing animation only`);
      }
      
      // Always start visual animation (regardless of grip state)
      console.log(`[ANIMATION] Starting visual animation: ${nextMove}`);
      
      // Store the move in history
      moveHistoryRef.current.push({ move: nextMove, index: nextIndex });
      
      // Update UI state immediately
      setCurrentMoveIndex(nextIndex);
      setCurrentMoveDescription(getMoveDescription(nextMove));
      setShowMoveExplanation(true);
      setIsAnimating(true);
    } else {
      isProcessingQueueRef.current = false;
    }
  };

  // Execute previous move without queue checks
  const executePrevMove = () => {
    if (moveHistoryRef.current.length === 0) {
      console.log(`[DEBUG] No moves in history to reverse`);
      isProcessingQueueRef.current = false;
      return;
    }
    
    // Get the last move we need to reverse
    const lastMove = moveHistoryRef.current[moveHistoryRef.current.length - 1];
    
    console.log(`[DEBUG] Reversing move: ${lastMove.move}, index: ${lastMove.index}, history length: ${moveHistoryRef.current.length}`);
    
    // Calculate the inverse move for ESP32
    const inverseMove = getReverseMove(lastMove.move);
    console.log(`[DEBUG] Calculated inverse move: ${inverseMove}`);
    
    // Only send inverse move to ESP32 if cube is gripped (for real-time movement visibility)
    if (cubeGripped) {
      console.log(`[ESP32] Cube is gripped - sending inverse move to robot: ${inverseMove} (original: ${lastMove.move})`);
      apiClient.sendMove(inverseMove)
        .then(response => {
          if (response.success) {
            console.log(`[ESP32] Inverse move completed successfully: ${inverseMove}`);
          } else {
            console.warn(`[ESP32] Inverse move completed with warning: ${response.message}`);
          }
        })
        .catch(error => {
          console.error(`[ESP32] Failed to send inverse move to hardware: ${error}`);
        });
    } else {
      console.log(`[ESP32] Cube not gripped - skipping robot reverse movement, showing animation only`);
    }
    
    // Always start visual animation (regardless of grip state)
    console.log(`[ANIMATION] Starting reverse animation: ${inverseMove} (original: ${lastMove.move})`);
    
    // Remove the last move from history AFTER sending to ESP32
    moveHistoryRef.current.pop();
    console.log(`[DEBUG] Move removed from history. New history length: ${moveHistoryRef.current.length}`);
    
    // Special case for first move - we need to go back to index -1
    const newIndex = lastMove.index === 0 ? -1 : lastMove.index - 1;
    console.log(`[DEBUG] Setting new index: ${newIndex}`);
    
    // Set up for reversing this move
    setCurrentMoveIndex(newIndex);
    setCurrentMoveDescription(`Undoing: ${getMoveDescription(lastMove.move)}`);
    setShowMoveExplanation(false);
    setIsReversing(true);
    
    // Play the reverse animation immediately
    setIsAnimating(true);
  };

  // Function to get pattern-specific explanations for visual learning
  const getPatternExplanation = (step: string, algorithmIndex: number): string => {
    const explanations: Record<string, string[]> = {
      cross: [
        "Watch how scattered white edge pieces move to form a plus (+) pattern on the bottom face. The edges align with their matching center colors.",
        "See how this alternative method positions the white edges while keeping the center pieces properly aligned with the sides."
      ],
      f2l: [
        "Observe how a white corner and its matching edge piece get paired together, then inserted as a unit into the bottom-right slot.",
        "Notice how separated corner-edge pieces get repositioned and then combined to complete another corner-edge pair."
      ],
      oll: [
        "Focus on the top face - watch how edge pieces flip to make the entire top face yellow (or your top color).",
        "See how the corner pieces on top rotate to complete the uniform top face color, creating a solid colored top layer."
      ],
      pll: [
        "Watch the T-Permutation: three corner pieces swap positions in a triangular pattern while edges stay in place.",
        "Observe the A-Permutation: corner pieces cycle clockwise to their final solved positions, completing the cube."
      ]
    };
    
    return explanations[step]?.[algorithmIndex] || "Watch how the pieces move to solve this part of the cube.";
  };

  // Function to describe the starting state for each CFOP step
  const getBeforeStateDescription = (step: string): string => {
    const descriptions: Record<string, string> = {
      cross: "White edges scattered around the cube",
      f2l: "Cross complete, but corners and edges need pairing",
      oll: "Bottom two layers solved, top face mixed colors",
      pll: "Top face uniform color, but pieces in wrong positions"
    };
    return descriptions[step] || "Cube needs solving";
  };

  // Function to describe the goal state for each CFOP step
  const getAfterStateDescription = (step: string): string => {
    const descriptions: Record<string, string> = {
      cross: "White cross formed on bottom face",
      f2l: "Bottom two layers completely solved",
      oll: "Top face shows uniform color (all yellow)",
      pll: "Entire cube solved - all faces uniform"
    };
    return descriptions[step] || "Part of cube solved";
  };

  // Function to describe what the current move is accomplishing
  const getCurrentMoveEffect = (step: string, moveIndex: number): string => {
    const currentAlgorithm = steps[step as keyof typeof steps]?.steps[selectedAlgorithmIndex];
    if (!currentAlgorithm) return "Processing move...";
    
    const moves = currentAlgorithm.moves.split(' ');
    const currentMove = moves[moveIndex];
    if (!currentMove) return "Move completed";
    
    const moveEffects: Record<string, Record<string, string[]>> = {
      cross: {
        default: [
          "Positioning white edge piece",
          "Aligning edge with center",
          "Moving edge to correct slot",
          "Completing cross formation"
        ]
      },
      f2l: {
        default: [
          "Separating corner-edge pair",
          "Positioning corner piece",
          "Aligning edge piece",
          "Inserting paired pieces"
        ]
      },
      oll: {
        default: [
          "Flipping edge orientation",
          "Rotating corner piece",
          "Creating uniform top color",
          "Completing top face"
        ]
      },
      pll: {
        default: [
          "Swapping corner positions",
          "Cycling edge pieces",
          "Final positioning",
          "Completing solve"
        ]
      }
    };
    
    const effects = moveEffects[step]?.default || ["Processing cube move"];
    return effects[moveIndex % effects.length] || "Executing algorithm step";
  };

  // Reset move explanation when move changes
  useEffect(() => {
    setShowMoveExplanation(false);
  }, [currentMoveIndex]);

  const steps = {
    cross: {
      name: 'Cross',
      description: 'Form a cross on the bottom face',
      steps: [
        { moves: "F D R' U' R F'", description: 'Creates a white cross on the bottom - aligns edge pieces to form a plus sign pattern' },
        { moves: "R U R' F R F'", description: 'Alternative cross method - positions edge pieces while maintaining center alignment' }
      ]
    },
    f2l: {
      name: 'F2L',
      description: 'First Two Layers',
      steps: [
        { moves: "R U' R' F R F'", description: 'Pairs corner and edge pieces together, then inserts them into the bottom two layers' },
        { moves: "F R U R' U' F'", description: 'Separates paired pieces and repositions them for proper corner-edge alignment' }
      ]
    },
    oll: {
      name: 'OLL',
      description: 'Orientation of Last Layer',
      steps: [
        { moves: "F R U R' U' F'", description: 'Flips edge pieces to make the top face all the same color (usually yellow)' },
        { moves: "R U R' U R U2 R'", description: 'Rotates corner pieces to complete the top face color - creates uniform top layer' }
      ]
    },
    pll: {
      name: 'PLL',
      description: 'Permutation of Last Layer',
      steps: [
        { moves: "R U R' F' R U R' U' R' F R2 U' R'", description: 'T-Permutation: Swaps three corner pieces in a T-pattern to solve the final layer' },
        { moves: "R' U R' U' R' U' R' U R U R2", description: 'A-Permutation: Cycles three corner pieces clockwise to complete the cube solution' }
      ]
    }
  };

  // Initialize cube state
  useEffect(() => {
    // Create initial cube state
    const positions: [number, number, number][] = [];
    const colors: string[][] = [];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          positions.push([x, y, z]);
          const cubeColors = [
            x === 1 ? '#e60000' : '#2a2a2a',  // Right - Bright Red
            x === -1 ? '#cc00ff' : '#2a2a2a', // Left - Bright Magenta/Purple
            y === 1 ? '#ffffff' : '#2a2a2a',  // Top - White
            y === -1 ? '#ffdd00' : '#2a2a2a', // Bottom - Bright Yellow
            z === 1 ? '#00cc00' : '#2a2a2a',  // Front - Bright Green
            z === -1 ? '#0066ff' : '#2a2a2a'  // Back - Bright Blue
          ];
          colors.push(cubeColors);
        }
      }
    }

    const initialState = { positions, colors };
    currentStateRef.current = initialState;
    stateHistoryRef.current = [initialState];
  }, []);

  // Get the reverse of a move
  const getReverseMove = (move: string): string => {
    if (move.includes("'")) {
      return move.replace("'", "");
    } else if (move.includes("2")) {
      return move; // Double moves are their own reverse
    } else {
      return move + "'";
    }
  };

  if (error) {
    return (
      <div className="p-6 bg-red-100 rounded-lg">
        <h3 className="text-red-600">Error loading Learning Mode</h3>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const currentStep = steps[selectedStep as keyof typeof steps];
  const currentAlgorithm = currentStep?.steps[selectedAlgorithmIndex];
  const currentMoves = currentAlgorithm?.moves.split(' ') || [];

  const handleNextMove = () => {
    // Add to queue if animating, otherwise execute immediately
    if (isAnimating) {
      moveQueueRef.current.push('next');
      console.log('Next move queued during animation');
      return;
    }
    
    executeNextMove();
  };

  const handlePrevMove = () => {
    // Add to queue if animating, otherwise execute immediately
    if (isAnimating) {
      moveQueueRef.current.push('prev');
      console.log('Previous move queued during animation');
      return;
    }
    
    executePrevMove();
  };

  const handleMoveComplete = () => {
    // Store the current state in history if it exists
    if (currentStateRef.current) {
      // Make a deep copy of the current state to avoid reference issues
      const stateCopy = {
        positions: currentStateRef.current.positions.map(pos => [...pos] as [number, number, number]),
        colors: currentStateRef.current.colors.map(colors => [...colors])
      };
      stateHistoryRef.current.push(stateCopy);
    }
    
    setIsAnimating(false);
    isProcessingQueueRef.current = false;
    
    // Handle reverse move completion
    if (isReversing) {
      setIsReversing(false);
      
      // If we've reversed back to the beginning, clear the description
      if (moveHistoryRef.current.length === 0) {
        setCurrentMoveIndex(-1);
        setCurrentMoveDescription("");
      } else {
        const prevMove = moveHistoryRef.current[moveHistoryRef.current.length - 1];
        setCurrentMoveIndex(prevMove.index);
        setCurrentMoveDescription(getMoveDescription(prevMove.move));
      }
    }
    
    if (!moveHistoryRef.current.length) {
      setCurrentMoveDescription("");
    }
    
    // Process next queued move after a short delay
    setTimeout(() => {
      processNextQueuedMove();
    }, 100);
  };

  const handleResetDemo = () => {
    console.log("[DEBUG] Reset button pressed - resetting demo and releasing cube");
    
    setCurrentMoveIndex(-1);
    setIsAnimating(false);
    setIsReversing(false);
    moveHistoryRef.current = [];
    setCurrentMoveDescription("");
    setShowMoveExplanation(false);
    
    // Clear the move queue and reset processing state
    moveQueueRef.current = [];
    isProcessingQueueRef.current = false;
    
    // Send cube release command to ESP32
    console.log("[ESP32] Sending cube release command to hardware");
    apiClient.sendMove("RELEASE")
      .then(response => {
        if (response.success) {
          console.log("[ESP32] Cube released successfully");
        } else {
          console.warn("[ESP32] Cube release completed with warning:", response.message);
        }
      })
      .catch(error => {
        console.error("[ESP32] Failed to send cube release command:", error);
      });
    
    // Reset to the initial state
    if (stateHistoryRef.current.length > 0) {
      // Make a deep copy of the initial state
      const initialState = stateHistoryRef.current[0];
      currentStateRef.current = {
        positions: initialState.positions.map(pos => [...pos] as [number, number, number]),
        colors: initialState.colors.map(colors => [...colors])
      };
      
      // Reset the state history
      stateHistoryRef.current = [currentStateRef.current];
    }
    
    // Force a re-render of the cube
    setCubeKey(prev => prev + 1);
    
    console.log("Demo reset to initial state");
  };

  const handleAlgorithmChange = (index: number) => {
    setSelectedAlgorithmIndex(index);
    setCurrentMoveIndex(-1);
    setIsAnimating(false);
    setIsReversing(false);
    moveHistoryRef.current = [];
    setCurrentMoveDescription("");
    setShowMoveExplanation(false);
    
    // Clear the move queue and reset processing state
    moveQueueRef.current = [];
    isProcessingQueueRef.current = false;
    
    // Reset to the initial state
    if (stateHistoryRef.current.length > 0) {
      // Make a deep copy of the initial state
      const initialState = stateHistoryRef.current[0];
      currentStateRef.current = {
        positions: initialState.positions.map(pos => [...pos] as [number, number, number]),
        colors: initialState.colors.map(colors => [...colors])
      };
      
      // Reset the state history
      stateHistoryRef.current = [currentStateRef.current];
    }
    
    // Force a re-render of the cube
    setCubeKey(prev => prev + 1);
    
    console.log(`Changed to algorithm ${index}`);
  };

  const handleStepChange = (step: string) => {
    setSelectedStep(step);
    setSelectedAlgorithmIndex(0);
    setCurrentMoveIndex(-1);
    setIsAnimating(false);
    setIsReversing(false);
    moveHistoryRef.current = [];
    setCurrentMoveDescription("");
    setShowMoveExplanation(false);
    
    // Clear the move queue and reset processing state
    moveQueueRef.current = [];
    isProcessingQueueRef.current = false;
    
    // Reset to the initial state
    if (stateHistoryRef.current.length > 0) {
      // Make a deep copy of the initial state
      const initialState = stateHistoryRef.current[0];
      currentStateRef.current = {
        positions: initialState.positions.map(pos => [...pos] as [number, number, number]),
        colors: initialState.colors.map(colors => [...colors])
      };
      
      // Reset the state history
      stateHistoryRef.current = [currentStateRef.current];
    }
    
    // Force a re-render of the cube
    setCubeKey(prev => prev + 1);
    
    console.log(`Changed to step ${step}`);
  };

  // Get the current move to display (either forward or reverse)
  const getCurrentMove = () => {
    if (!isAnimating) return undefined;
    
    // If we're reversing, return the move we're undoing
    if (isReversing) {
      // If we're at index -1, we're reversing the first move
      const moveIndex = currentMoveIndex + 1;
      const moveToReverse = currentMoves[moveIndex];
      console.log(`Returning move to reverse: ${moveToReverse} (index: ${moveIndex})`);
      return moveToReverse;
    }
    
    // Return the current move from the moves array for forward movement
    if (currentMoveIndex >= 0) {
      console.log(`Returning forward move: ${currentMoves[currentMoveIndex]} (index: ${currentMoveIndex})`);
      return currentMoves[currentMoveIndex];
    }
    
    return undefined;
  };

  return (
    <div className="space-y-6 min-h-screen p-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Learning Mode</h2>
        <p className="text-white/70">Learn the CFOP method step by step</p>
      </div>

      {/* Step Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(steps).map(([key, step]) => (
          <button
            key={key}
            onClick={() => handleStepChange(key)}
            className={`p-4 rounded-xl transition-all ${
              selectedStep === key
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <div className="font-medium">{step.name}</div>
          </button>
        ))}
      </div>

      {/* Current Step Details */}
      {currentStep && (
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-2">{currentStep.name}</h3>
          <p className="text-white/70 mb-6">{currentStep.description}</p>

          {/* Algorithm Selection */}
          <div className="flex gap-4 mb-6">
            {currentStep.steps.map((algorithm, index) => (
              <button
                key={index}
                onClick={() => handleAlgorithmChange(index)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  selectedAlgorithmIndex === index
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Algorithm {index + 1}
              </button>
            ))}
          </div>

          {/* Algorithm Description */}
          <p className="text-white/70 mb-6">{currentAlgorithm.description}</p>
          
          {/* Compact Visual Learning Section */}
          <div className="mb-6 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            {/* Progress Bar */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Learning Progress</h4>
              {currentMoveIndex >= 0 && (
                <div className="text-sm text-white/70">
                  {currentMoveIndex + 1} / {currentAlgorithm.moves.split(' ').length}
                </div>
              )}
            </div>
            
            {/* Compact Progress Indicator */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="flex-1 bg-white/10 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: currentMoveIndex >= 0 
                        ? `${((currentMoveIndex + 1) / currentAlgorithm.moves.split(' ').length) * 100}%` 
                        : '0%' 
                    }}
                  />
                </div>
              </div>
              <div className="text-xs text-white/60">
                {currentMoveIndex >= 0 
                  ? getCurrentMoveEffect(selectedStep, currentMoveIndex)
                  : getPatternExplanation(selectedStep, selectedAlgorithmIndex)
                }
              </div>
            </div>
            
            {/* Compact State Cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                <div className="text-red-300 text-xs font-medium">Problem</div>
                <div className="text-white/60 text-xs mt-1">{getBeforeStateDescription(selectedStep)}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                <div className="text-blue-300 text-xs font-medium">Current</div>
                <div className="text-white/60 text-xs mt-1">
                  {currentMoveIndex >= 0 ? `Step ${currentMoveIndex + 1}` : 'Ready'}
                </div>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <div className="text-green-300 text-xs font-medium">Goal</div>
                <div className="text-white/60 text-xs mt-1">{getAfterStateDescription(selectedStep)}</div>
              </div>
            </div>
            
            {/* Expandable Move Details */}
            {currentMoveIndex >= 0 && (
              <details className="group">
                <summary className="cursor-pointer text-sm text-purple-300 hover:text-purple-200 transition-colors flex items-center space-x-2">
                  <span>View Step Details</span>
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {currentAlgorithm.moves.split(' ').map((move, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center space-x-2 p-2 rounded text-xs transition-all ${
                        index === currentMoveIndex 
                          ? 'bg-purple-500/20 border border-purple-500/30' 
                          : index < currentMoveIndex 
                            ? 'bg-green-500/10' 
                            : 'bg-white/5'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                        index === currentMoveIndex 
                          ? 'bg-purple-500 text-white' 
                          : index < currentMoveIndex 
                            ? 'bg-green-500 text-white' 
                            : 'bg-white/20 text-white/60'
                      }`}>
                        {index < currentMoveIndex ? '✓' : index + 1}
                      </div>
                      <span className={`font-mono ${
                        index === currentMoveIndex ? 'text-purple-300 font-bold' : 
                        index < currentMoveIndex ? 'text-green-300' : 'text-white/60'
                      }`}>
                        {move}
                      </span>
                      <span className={`flex-1 text-xs ${
                        index === currentMoveIndex ? 'text-purple-200' : 
                        index < currentMoveIndex ? 'text-green-200' : 'text-white/40'
                      }`}>
                        {getMoveDescription(move)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* 3D Cube Visualization */}
          <div className="relative aspect-square w-full max-w-2xl mx-auto mb-6 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-white/10"></div>
            <RubiksCube3D
              key={cubeKey}
              currentMove={getCurrentMove()}
              onMoveComplete={handleMoveComplete}
              initialState={currentStateRef.current || undefined}
              isReverse={isReversing}
            />
            

            
            {/* Interactive Move Indicator */}
            {currentMoveIndex >= 0 && (
              <div className="absolute top-2 left-2">
                <button
                  onClick={() => setShowMoveExplanation(!showMoveExplanation)}
                  className="bg-black/50 hover:bg-black/70 px-3 py-1 rounded-full transition-all duration-200 cursor-pointer"
                >
                  <span className="text-white font-mono font-bold">
                    {currentMoves[currentMoveIndex]}
                  </span>
                </button>
                
                {/* Move Explanation Tooltip */}
                {showMoveExplanation && (
                  <div className="absolute top-full left-0 mt-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-3 min-w-[180px] z-10">
                    <div className="text-white text-sm font-medium">
                      {getBeginnerMoveExplanation(currentMoves[currentMoveIndex])}
                    </div>
                    <div className="absolute -top-1 left-3 w-2 h-2 bg-black/90 border-l border-t border-white/20 rotate-45"></div>
                  </div>
                )}
              </div>
            )}
            
            {/* View Angle Helper for Back Moves */}
            {getCurrentMove()?.startsWith('B') && (
              <div className="absolute bottom-2 left-2 bg-orange-500/80 px-3 py-1 rounded-full">
                <span className="text-white text-xs font-medium">
                  Rotate cube to see back face (blue)
                </span>
              </div>
            )}
          </div>

          {/* Move Controls */}
          <div className="flex flex-col gap-6">
            {/* Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ 
                  width: `${((moveHistoryRef.current.length) / currentMoves.length) * 100}%`,
                  display: moveHistoryRef.current.length === 0 ? 'none' : 'block'
                }}
              ></div>
            </div>

            {/* Robot Grip Section (Optional) */}
            {!cubeGripped && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                <div className="text-center mb-3">
                  <h4 className="text-sm font-medium text-white mb-1">Optional: Robot Grip</h4>
                  <p className="text-xs text-white/70">Have the robot grip the cube to see real-time movements during learning</p>
                </div>
                <button
                  onClick={handleGripCube}
                  disabled={isGripping}
                  className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-medium transition-all duration-150 text-sm"
                >
                  {isGripping ? 'Gripping Cube...' : 'Grip Cube for Real-Time Movement'}
                </button>
              </div>
            )}

            {cubeGripped && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm text-green-400 font-medium">Robot Ready - Real-Time Movement Active</span>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrevMove}
                disabled={moveHistoryRef.current.length === 0 || isAnimating}
                className={`px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all ${
                  (moveHistoryRef.current.length === 0 || isAnimating) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                ← Previous
              </button>
              <button
                onClick={handleResetDemo}
                disabled={isAnimating}
                className={`px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all ${
                  isAnimating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Reset
              </button>
              <button
                onClick={handleNextMove}
                disabled={currentMoveIndex >= currentMoves.length - 1 || isAnimating}
                className={`px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all ${
                  (currentMoveIndex >= currentMoves.length - 1 || isAnimating) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Move List */}
          <div className="mt-6 p-4 bg-black/20 rounded-xl">
            <div className="flex flex-wrap gap-2">
              {currentMoves.map((move, index) => {
                const isInHistory = moveHistoryRef.current.some(m => m.index === index);
                return (
                  <span
                    key={index}
                    className={`px-3 py-1 rounded-lg text-sm font-mono transition-all ${
                      index === currentMoveIndex
                        ? 'bg-blue-500 text-white scale-110'
                        : isInHistory
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-white/10 text-white/70'
                    }`}
                    title={getMoveDescription(move)}
                  >
                    {move}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center text-white/70">
            <p>Click Next to proceed through each move of the algorithm.</p>
          </div>
        </div>
      )}



      {/* Enhanced Learning Tips */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Learning Tips</h3>
          <div className="text-xs text-white/50">CFOP Mastery Guide</div>
        </div>
        
        {/* Compact Tip Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Visual Learning Tips */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-blue-300 text-sm font-medium">Visual Learning</span>
            </div>
            <ul className="text-xs text-white/70 space-y-1">
              <li>• Watch the progress bar to track algorithm completion</li>
              <li>• Use "View Step Details" to understand each move</li>
              <li>• Rotate the cube to see back face moves (B, B')</li>
            </ul>
          </div>
          
          {/* Practice Strategy */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-green-300 text-sm font-medium">Practice Strategy</span>
            </div>
            <ul className="text-xs text-white/70 space-y-1">
              <li>• Master Cross first - it's the CFOP foundation</li>
              <li>• Practice algorithms slowly, then build speed</li>
              <li>• Focus on smooth finger movements</li>
            </ul>
          </div>
          
          {/* Pattern Recognition */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-purple-300 text-sm font-medium">Pattern Recognition</span>
            </div>
            <ul className="text-xs text-white/70 space-y-1">
              <li>• Learn to spot when each algorithm is needed</li>
              <li>• Understand the "Problem → Goal" for each step</li>
              <li>• Practice identifying cube states quickly</li>
            </ul>
          </div>
          
          {/* Progression Guide */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
              <span className="text-orange-300 text-sm font-medium">Progression Guide</span>
            </div>
            <ul className="text-xs text-white/70 space-y-1">
              <li>• Don't rush - master each step completely</li>
              <li>• Use move explanations to understand notation</li>
              <li>• Practice on a real cube alongside the app</li>
            </ul>
          </div>
        </div>
        
        {/* Quick Reference */}
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center space-x-2">
            <span>Quick Reference Guide</span>
            <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="mt-2 p-3 bg-white/5 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-white/80 font-medium mb-1">Move Notation:</div>
                <div className="text-white/60 space-y-1">
                  <div>R = Right face clockwise</div>
                  <div>R' = Right face counter-clockwise</div>
                  <div>R2 = Right face 180°</div>
                </div>
              </div>
              <div>
                <div className="text-white/80 font-medium mb-1">CFOP Steps:</div>
                <div className="text-white/60 space-y-1">
                  <div>1. Cross (white edges)</div>
                  <div>2. F2L (first two layers)</div>
                  <div>3. OLL (orient last layer)</div>
                  <div>4. PLL (permute last layer)</div>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default LearningMode;
