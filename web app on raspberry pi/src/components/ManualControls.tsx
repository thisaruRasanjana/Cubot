import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const ManualControls: React.FC = () => {
  const recordManualMove = useMutation(api.cubot.recordManualMove);

  const handleMoveClick = async (move: string) => {
    await recordManualMove({ move });
    
    // Visual feedback
    const button = document.querySelector(`[data-move="${move}"]`) as HTMLButtonElement;
    if (button) {
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = 'scale(1)';
      }, 100);
    }
  };

  const moves = [
    ['U', "U'", 'U2'],
    ['R', "R'", 'R2'],
    ['F', "F'", 'F2'],
    ['D', "D'", 'D2'],
    ['L', "L'", 'L2'],
    ['B', "B'", 'B2'],
  ];

  return (
    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Manual Controls</h3>
      
      <div className="space-y-2">
        {moves.map((row, rowIndex) => (
          <div key={rowIndex} className="flex space-x-2">
            {row.map((move) => (
              <button
                key={move}
                data-move={move}
                onClick={() => handleMoveClick(move)}
                className="flex-1 py-3 bg-white/10 hover:bg-blue-500 text-white border border-white/20 hover:border-blue-500 rounded-lg font-mono font-bold text-sm transition-all transform hover:scale-105 active:scale-95"
              >
                {move}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManualControls;
