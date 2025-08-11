import React, { useState, useEffect } from 'react';
import { apiClient } from './lib/api';
import ModeSelection from './components/ModeSelection';
import SolvingInterface from './components/SolvingInterface';
import LearningMode from './components/LearningMode';
import CameraScanner from './components/CameraScanner';

type AppMode = 'selection' | 'solving' | 'learning' | 'scanning';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('selection');
  const [scanningFace, setScanningFace] = useState<string | null>(null);
  const [scannedFaces, setScannedFaces] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [solutionMoves, setSolutionMoves] = useState<string[]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [solvingAttempted, setSolvingAttempted] = useState(false); // Track if solving was attempted for current scan
  
  // Debug logging for solvingAttempted state changes
  useEffect(() => {
    console.log('[DEBUG] solvingAttempted state changed to:', solvingAttempted);
  }, [solvingAttempted]);
  const [cubeGripped, setCubeGripped] = useState(false);
  const [isGripping, setIsGripping] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ serialConnected: false, currentMode: 'solving' });

  // Poll backend for connection status
  useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        const status = await apiClient.getSystemStatus();
        setSystemStatus(prev => ({
          ...prev,
          serialConnected: status.serialConnected,
          currentMode: status.currentMode || prev.currentMode
        }));
      } catch (error) {
        console.error('Failed to get system status:', error);
        setSystemStatus(prev => ({ ...prev, serialConnected: false }));
      }
    };

    // Check immediately on mount
    checkConnectionStatus();

    // Then check every 5 seconds
    const interval = setInterval(checkConnectionStatus, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  const handleModeSelect = (mode: 'solving' | 'learning') => {
    console.log(`[DEBUG] Mode selected: ${mode} - releasing robot arms`);
    
    // Reset gripping state when switching modes
    setCubeGripped(false);
    setIsGripping(false);
    
    // Send release command to ESP32 when mode is selected
    console.log("[ESP32] Sending cube release command on mode selection");
    apiClient.sendMove("RELEASE")
      .then(response => {
        if (response.success) {
          console.log(`[ESP32] Robot arms released successfully for ${mode} mode`);
        } else {
          console.warn(`[ESP32] Robot arms release completed with warning for ${mode} mode:`, response.message);
        }
      })
      .catch(error => {
        console.error(`[ESP32] Failed to send release command for ${mode} mode:`, error);
      });
    
    setCurrentMode(mode);
    setSystemStatus(prev => ({ ...prev, currentMode: mode }));
  };

  const handleBackToSelection = () => {
    setCurrentMode('selection');
    setScannedFaces({});
    setScanningFace(null);
    setSolutionMoves([]);
    setIsSolving(false);
  };

  const handleGripCube = async () => {
    try {
      console.log('[DEBUG] Starting cube gripping process...');
      setIsGripping(true);
      
      // Send GRIP command to ESP32
      const result = await apiClient.gripCube();
      console.log('[DEBUG] ESP32 grip command result:', result);
      
      if (result.success) {
        console.log('[DEBUG] ESP32 cube gripping successful');
        setCubeGripped(true);
      } else {
        console.error('[ERROR] Failed to grip cube:', result);
        // Allow user to try again
      }
    } catch (error) {
      console.error('[ERROR] Exception during cube gripping:', error);
    } finally {
      setIsGripping(false);
    }
  };

  const handleStartScanning = async () => {
    try {
      console.log('[DEBUG] Starting cube scanning process...');
      
      // STEP 1: Pre-initialize camera interface first (this takes time)
      console.log('[DEBUG] Pre-initializing camera interface...');
      setCurrentMode('scanning');
      setScanningFace('top');
      setScannedFaces({});
      setSolutionMoves([]);
      setSolvingAttempted(false); // Reset solving state for new scan session
      
      // Give camera a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // STEP 2: Now send SCAN command to ESP32 (camera is ready)
      console.log('[DEBUG] Camera ready, sending SCAN command to ESP32...');
      const result = await apiClient.startScan();
      console.log('[DEBUG] ESP32 scan command result:', result);
      
      if (result.success) {
        console.log('[DEBUG] ESP32 scanning started - camera is already initialized!');
      } else {
        console.error('[ERROR] Failed to start ESP32 scanning:', result);
        console.log('[DEBUG] Continuing with manual camera scanning...');
      }
    } catch (error) {
      console.error('[ERROR] Exception during ESP32 scan start:', error);
      console.log('[DEBUG] Continuing with manual camera scanning...');
    }
  };

  const handleImageCapture = async (imageData: string, face: string) => {
    console.log(`Starting image capture for face: ${face}`);
    setIsProcessing(true);
    
    try {
      const result = await apiClient.processCubeImage(imageData, face);
      console.log(`Received result from Flask for face ${face}:`, result);
      
      if (!result || !result.faceColors) {
        throw new Error('Invalid response from server');
      }
      
      setScannedFaces(prev => ({
        ...prev,
        [face]: result.faceColors
      }));

      const faceOrder = ['top', 'right', 'front', 'bottom', 'left', 'back'];
      const currentIndex = faceOrder.indexOf(face);
      
      // Short delay before moving to next face or fetching solution
      setTimeout(async () => {
        if (currentIndex < faceOrder.length - 1) {
          setScanningFace(faceOrder[currentIndex + 1]);
          setIsProcessing(false);
        } else {
          // All faces scanned - fetch solution moves
          console.log('All faces scanned! Fetching solution moves...');
          try {
            const movesResult = await apiClient.getMoves();
            console.log('Solution moves result:', movesResult);
            
            if (movesResult.moves) {
              // Parse moves string into array
              const movesArray = movesResult.moves.trim().split(/\s+/).filter((move: string) => move.length > 0);
              console.log('Parsed solution moves:', movesArray);
              setSolutionMoves(movesArray);
            } else {
              console.log('No moves available yet, status:', movesResult.status);
              setSolutionMoves([]);
            }
          } catch (error) {
            console.error('Failed to fetch solution moves:', error);
            setSolutionMoves([]);
          }
          
          setCurrentMode('solving');
          setScanningFace(null);
          setIsProcessing(false);
        }
      }, 500);

    } catch (error) {
      console.error('Failed to process image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to process image for ${face}: ${errorMessage}`);
      setIsProcessing(false);
    }
  };

  const handleScanningComplete = () => {
    setCurrentMode('solving');
    setScanningFace(null);
  };

  const handleScanningCancel = () => {
    setCurrentMode('solving');
    setScanningFace(null);
    setScannedFaces({});
  };

  const handleStartSolving = async () => {
    console.log('[DEBUG] === handleStartSolving CALLED ===');
    console.log('[DEBUG] Current solvingAttempted state:', solvingAttempted);
    console.log('[DEBUG] Current solutionMoves.length:', solutionMoves.length);
    
    // Silently return if no solution moves (button should be disabled anyway)
    if (solutionMoves.length === 0) {
      console.log('[DEBUG] No solution moves, returning early');
      return;
    }

    // Silently return if solving was already attempted (button should be disabled)
    if (solvingAttempted) {
      console.log('[DEBUG] solvingAttempted is true, silently blocking duplicate request');
      return;
    }

    // IMMEDIATELY disable the button on first press (like Grip Cube button)
    console.log('[DEBUG] About to set solvingAttempted to true');
    setSolvingAttempted(true);
    console.log('[DEBUG] setSolvingAttempted(true) called');
    
    setIsSolving(true);
    console.log('[DEBUG] setIsSolving(true) called');
    
    try {
      console.log('[DEBUG] About to call apiClient.startSolving()');
      await apiClient.startSolving();
      console.log('[DEBUG] apiClient.startSolving() completed successfully');
      // No alert - silent operation like Grip Cube button
    } catch (error: any) {
      console.error('[DEBUG] apiClient.startSolving() failed with error:', error);
      // No alert - silent operation like Grip Cube button
    } finally {
      console.log('[DEBUG] Setting isSolving to false');
      setIsSolving(false);
      console.log('[DEBUG] === handleStartSolving COMPLETED ===');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={handleBackToSelection}
                className={`mr-4 p-2 rounded-lg transition-all ${
                  currentMode !== 'selection' 
                    ? 'text-white/70 hover:text-white hover:bg-white/10' 
                    : 'invisible'
                }`}
              >
                ←
              </button>
            </div>
            
            {/* Centered Title with Branding */}
            <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
              <h1 className="text-2xl font-bold text-white">CUBOT</h1>
              <p className="text-xs text-white/60 -mt-1">by Bizards</p>
            </div>
            {/* Empty right side for clean header */}
            <div></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentMode === 'selection' && (
          <ModeSelection onModeSelect={handleModeSelect} />
        )}
        
        {currentMode === 'solving' && (
          <SolvingInterface
            activeSolvingSession={null}
            systemStatus={systemStatus}
            scannedFaces={scannedFaces}
            solutionMoves={solutionMoves}
            isSolving={isSolving}
            solvingAttempted={solvingAttempted}
            cubeGripped={cubeGripped}
            isGripping={isGripping}
            onGripCube={handleGripCube}
            onStartScanning={handleStartScanning}
            onStartSolving={handleStartSolving}
          />
        )}
        
        {currentMode === 'learning' && (
          <LearningMode 
            cfopSteps={null}
            learningProgress={null}
            scannedFaces={scannedFaces}
            onStartScanning={handleStartScanning}
          />
        )}
        
        {currentMode === 'scanning' && scanningFace && (
          <CameraScanner
            currentFace={scanningFace}
            scannedFaces={scannedFaces}
            isProcessing={isProcessing}
            onImageCapture={handleImageCapture}
            onComplete={handleScanningComplete}
            onCancel={handleScanningCancel}
          />
        )}
      </main>
      
      {/* Floating Connection Status Indicator */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-full px-3 py-2 flex items-center space-x-2 shadow-lg">
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            systemStatus.serialConnected ? 'bg-green-400' : 'bg-red-400'
          }`} />
          <span className="text-white/80 text-xs font-medium">
            {systemStatus.serialConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
