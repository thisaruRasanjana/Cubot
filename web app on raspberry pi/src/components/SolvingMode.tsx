import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface SolvingModeProps {
  activeSolvingSession: any;
  systemStatus: any;
}

const SolvingMode: React.FC<SolvingModeProps> = ({ activeSolvingSession, systemStatus }) => {
  const [isScrambling, setIsScrambling] = useState(false);
  
  const startSolvingSession = useMutation(api.cubot.startSolvingSession);
  const stopSolvingSession = useMutation(api.cubot.stopSolvingSession);
  const updateSolvingProgress = useMutation(api.cubot.updateSolvingProgress);
  const completeSolvingSession = useMutation(api.cubot.completeSolvingSession);

  const handleStartSolving = async () => {
    try {
      const cubeState = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"; // Solved state
      const result = await startSolvingSession({ cubeState });
      
      // Simulate solving progress
      simulateSolvingProgress(result.sessionId, result.moves);
    } catch (error) {
      console.error('Failed to start solving:', error);
    }
  };

  const handleStopSolving = async () => {
    if (activeSolvingSession) {
      await stopSolvingSession({ sessionId: activeSolvingSession._id });
    }
  };

  const handleScramble = async () => {
    setIsScrambling(true);
    
    // Generate random scramble moves
    const moves = ['R', "R'", 'U', "U'", 'F', "F'", 'L', "L'", 'D', "D'", 'B', "B'"];
    const scrambleMoves = [];
    
    for (let i = 0; i < 20; i++) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      scrambleMoves.push(randomMove);
    }
    
    // Simulate scramble execution
    setTimeout(() => {
      setIsScrambling(false);
    }, 4000);
  };

  const simulateSolvingProgress = async (sessionId: any, moves: string[]) => {
    for (let i = 0; i < moves.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (activeSolvingSession?.isActive) {
        await updateSolvingProgress({
          sessionId,
          currentStep: i + 1,
          currentMove: moves[i],
        });
      } else {
        break;
      }
    }
    
    if (activeSolvingSession?.isActive) {
      await completeSolvingSession({ sessionId });
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isActive = activeSolvingSession?.isActive;
  const progress = activeSolvingSession || {};

  return (
    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Cube Solver Dashboard</h2>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Move Count</div>
            <div className="text-2xl font-bold text-blue-400">{progress.currentStep || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Elapsed Time</div>
            <div className="text-2xl font-bold text-blue-400">
              {formatTime(progress.elapsedTime || 0)}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Progress</div>
            <div className="text-2xl font-bold text-blue-400">
              {Math.round(progress.progressPercent || 0)}%
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
              style={{ width: `${progress.progressPercent || 0}%` }}
            />
          </div>
          <div className="text-center text-white/80 text-sm font-mono">
            {isActive ? `Current move: ${progress.moves?.[progress.currentStep - 1] || 'Starting...'}` : 'Ready to solve'}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleStartSolving}
            disabled={isActive || isScrambling}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all"
          >
            <span>▶️</span>
            <span>Start</span>
          </button>
          <button
            onClick={handleStopSolving}
            disabled={!isActive}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white border border-white/20 rounded-xl font-medium transition-all"
          >
            <span>⏹️</span>
            <span>Stop</span>
          </button>
          <button
            onClick={handleScramble}
            disabled={isActive || isScrambling}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-transparent hover:bg-blue-500 disabled:opacity-50 text-blue-400 hover:text-white border border-blue-400 hover:border-blue-500 rounded-xl font-medium transition-all"
          >
            <span>🔀</span>
            <span>{isScrambling ? 'Scrambling...' : 'Scramble'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolvingMode;
