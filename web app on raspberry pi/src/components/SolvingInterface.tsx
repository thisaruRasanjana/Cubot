import React, { useState, useEffect } from 'react';

interface SolvingInterfaceProps {
  activeSolvingSession: any;
  systemStatus: any;
  scannedFaces: Record<string, string>;
  solutionMoves: string[];
  isSolving: boolean;
  solvingAttempted: boolean;
  cubeGripped: boolean;
  isGripping: boolean;
  onGripCube: () => void;
  onStartScanning: () => void;
  onStartSolving: () => void;
}

const SolvingInterface: React.FC<SolvingInterfaceProps> = ({
  activeSolvingSession,
  systemStatus,
  scannedFaces,
  solutionMoves,
  isSolving,
  solvingAttempted,
  cubeGripped,
  isGripping,
  onGripCube,
  onStartScanning,
  onStartSolving
}) => {
  // Timer state
  const [solveStartTime, setSolveStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [finalSolveTime, setFinalSolveTime] = useState<number | null>(null);

  const scannedFaceCount = Object.keys(scannedFaces).length;
  const allFacesScanned = scannedFaceCount === 6;
  const hasSolution = solutionMoves.length > 0;
  
  // Timer effects - fetch actual solve time from backend
  useEffect(() => {
    // Start timer when solving begins
    if (isSolving && !solveStartTime) {
      setSolveStartTime(Date.now());
      setFinalSolveTime(null);
    }
    // When solving ends, fetch actual solve time from backend
    if (!isSolving && solveStartTime && !finalSolveTime) {
      // Fetch actual robot solve time from backend
      fetch('/api/get_solve_time')
        .then(response => response.json())
        .then(data => {
          if (data.available && data.solve_time) {
            setFinalSolveTime(data.solve_time);
            console.log(`[TIMER] Backend reported actual solve time: ${data.solve_time}s`);
          } else {
            // Fallback to frontend timing if backend time not available
            const endTime = Date.now();
            const totalTime = (endTime - solveStartTime) / 1000;
            setFinalSolveTime(totalTime);
            console.log(`[TIMER] Using frontend fallback time: ${totalTime}s`);
          }
          setSolveStartTime(null);
          setElapsedTime(0);
        })
        .catch(error => {
          console.error('[TIMER] Error fetching solve time:', error);
          // Fallback to frontend timing
          const endTime = Date.now();
          const totalTime = (endTime - solveStartTime) / 1000;
          setFinalSolveTime(totalTime);
          setSolveStartTime(null);
          setElapsedTime(0);
        });
    }
  }, [isSolving, solveStartTime, finalSolveTime]);

  // Update elapsed time every second while solving
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSolving && solveStartTime) {
      interval = setInterval(() => {
        setElapsedTime((Date.now() - solveStartTime) / 1000);
      }, 100); // Update every 100ms for smooth display
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSolving, solveStartTime]);

  // Reset timer when starting new scan session
  useEffect(() => {
    if (scannedFaceCount === 0) {
      setFinalSolveTime(null);
      setElapsedTime(0);
      setSolveStartTime(null);
    }
  }, [scannedFaceCount]);

  // Helper function to format time display
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
  };

  // Debug logging for button state
  const buttonDisabled = !hasSolution || !systemStatus?.serialConnected || isSolving || solvingAttempted;
  
  console.log('[DEBUG] SolvingInterface render:');
  console.log('[DEBUG] - solvingAttempted prop:', solvingAttempted);
  console.log('[DEBUG] - hasSolution:', hasSolution);
  console.log('[DEBUG] - systemStatus?.serialConnected:', systemStatus?.serialConnected);
  console.log('[DEBUG] - isSolving:', isSolving);
  console.log('[DEBUG] - buttonDisabled:', buttonDisabled);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Cube Solving Mode</h2>
        <p className="text-white/70">Scan your cube and let the robot solve it</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Scanning Status */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Cube Scanning</h3>
            <div className={`w-3 h-3 rounded-full ${
              allFacesScanned ? 'bg-green-400' : 'bg-yellow-400'
            }`} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Faces Scanned</span>
              <span className="text-white font-medium">{scannedFaceCount}/6</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(scannedFaceCount / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Solution Status */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Solution</h3>
            <div className={`w-3 h-3 rounded-full ${
              hasSolution ? 'bg-green-400' : allFacesScanned ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'
            }`} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Status</span>
              <span className="text-white font-medium">
                {hasSolution ? 'Ready' : allFacesScanned ? 'Processing...' : 'Waiting'}
              </span>
            </div>
            {hasSolution && (
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Moves</span>
                <span className="text-white font-medium">{solutionMoves.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Robot Status */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Robot</h3>
            <div className={`w-3 h-3 rounded-full ${
              systemStatus?.serialConnected ? 'bg-green-400' : 'bg-red-400'
            }`} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Connection</span>
              <span className="text-white font-medium">
                {systemStatus?.serialConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Status</span>
              <span className="text-white font-medium">{isSolving ? 'Solving...' : 'Ready'}</span>
            </div>
            {(isSolving || finalSolveTime !== null) && (
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Solve Time</span>
                <span className="text-white font-medium font-mono">
                  {isSolving ? (
                    <span className="text-blue-400">{formatTime(elapsedTime)}</span>
                  ) : finalSolveTime !== null ? (
                    <span className="text-green-400">{formatTime(finalSolveTime)}</span>
                  ) : null}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scanned Faces Display */}
      {scannedFaceCount > 0 && (
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Scanned Faces</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {['top', 'right', 'front', 'bottom', 'left', 'back'].map((face) => (
              <div key={face} className="text-center">
                <div className={`w-16 h-16 mx-auto mb-2 rounded-lg border-2 flex items-center justify-center ${
                  scannedFaces[face] 
                    ? 'border-green-400 bg-green-400/20' 
                    : 'border-white/30 bg-white/5'
                }`}>
                  {scannedFaces[face] ? (
                    <span className="text-green-400 text-xl">✓</span>
                  ) : (
                    <span className="text-white/50 text-xl">📷</span>
                  )}
                </div>
                <p className="text-white/70 text-sm capitalize">{face}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solution Moves Display */}
      {hasSolution && (
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Solution Moves</h3>
          <div className="flex flex-wrap gap-2">
            {solutionMoves.map((move, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 font-mono text-sm"
              >
                {move}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-4">
        {/* Step 1: Grip Cube */}
        {!cubeGripped && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">1</div>
              <h4 className="text-lg font-semibold text-white">Robot Must Grip Cube First</h4>
            </div>
            <p className="text-white/70 text-sm mb-4">Place your cube in the robot's grip area and press the button below to have the robot grab it securely.</p>
            <button
              onClick={onGripCube}
              disabled={!systemStatus?.serialConnected || isGripping}
              className="w-full px-6 py-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all duration-150 text-lg min-h-[56px] touch-manipulation"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
            >
              {isGripping ? 'Gripping Cube...' : 'Grip Cube'}
            </button>
          </div>
        )}

        {/* Step 2: Scan Cube (only available after gripping) */}
        {cubeGripped && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">2</div>
              <h4 className="text-lg font-semibold text-white">Scan Cube Faces</h4>
            </div>
            <p className="text-white/70 text-sm mb-4">Robot is ready! Start scanning to capture all 6 faces of your cube.</p>
            <button
              onClick={onStartScanning}
              className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl font-medium transition-all duration-150 text-lg min-h-[56px] touch-manipulation"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
            >
              {scannedFaceCount === 0 ? 'Start Scanning' : 'Rescan Cube'}
            </button>
          </div>
        )}

        {/* Step 3: Solve Cube - Always show section to prevent DOM re-rendering */}
        <div className={`${hasSolution ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-gray-500/30'} border rounded-xl p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 ${hasSolution ? 'bg-green-500' : 'bg-gray-500'} rounded-full flex items-center justify-center text-white font-bold`}>3</div>
            <h4 className="text-lg font-semibold text-white">Solve Cube</h4>
          </div>
          <p className="text-white/70 text-sm mb-4">
            {hasSolution 
              ? `Solution ready with ${solutionMoves.length} moves. Let the robot solve your cube!`
              : 'Scan all 6 faces to generate solution'
            }
          </p>
          <button
            onClick={onStartSolving}
            disabled={buttonDisabled}
            className="w-full px-6 py-4 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all duration-150 text-lg min-h-[56px] touch-manipulation"
            style={{
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
          >
            {isSolving ? 'Solving...' : 'Start Solving'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Instructions</h3>
        <div className="space-y-2 text-white/70">
          <p><strong className="text-orange-400">Step 1:</strong> Place your cube in the robot's grip area and click "Grip Cube"</p>
          <p><strong className="text-blue-400">Step 2:</strong> Click "Start Scanning" and follow instructions to capture all 6 faces</p>
          <p><strong className="text-green-400">Step 3:</strong> Wait for solution generation, then click "Start Solving"</p>
          <p className="text-white/50 text-sm mt-3">Note: The robot must grip the cube first before scanning can begin</p>
        </div>
      </div>
    </div>
  );
};

export default SolvingInterface;
