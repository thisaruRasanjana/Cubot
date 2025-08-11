import React from 'react';

interface ModeSelectionProps {
  onModeSelect: (mode: 'solving' | 'learning') => void;
}

const ModeSelection: React.FC<ModeSelectionProps> = ({ onModeSelect }) => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Choose Your Mode</h2>
          <p className="text-white/70 text-lg">Select how you'd like to interact with your cube</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => onModeSelect('solving')}
            className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl p-8 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">Solving Mode</h3>
              <p className="text-blue-100 text-sm">
                Scan your cube and get step-by-step solving instructions
              </p>
            </div>
          </button>

          <button
            onClick={() => onModeSelect('learning')}
            className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-2xl p-8 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">Learning Mode</h3>
              <p className="text-purple-100 text-sm">
                Learn CFOP method with interactive tutorials and practice
              </p>
            </div>
          </button>
        </div>

        <div className="text-center mt-8">
          <p className="text-white/50 text-sm">
            New to cubing? Start with Learning Mode to master the basics!
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;
