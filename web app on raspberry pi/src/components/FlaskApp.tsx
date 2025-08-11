import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { useSystemStatus, useActiveSolvingSession, useCFOPSteps, useLearningProgress, useFlaskMutation } from '../hooks/useFlaskApi';
import ModeSelection from './ModeSelection';
import SolvingInterface from './SolvingInterface';
import LearningMode from './LearningMode';
import CameraScanner from './CameraScanner';

type AppMode = 'selection' | 'solving' | 'learning' | 'scanning';

function FlaskApp() {
  const [currentMode, setCurrentMode] = useState<AppMode>('selection');
  const [scanningFace, setScanningFace] = useState<string | null>(null);
  const [scannedFaces, setScannedFaces] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Flask API hooks
  const { data: systemStatus, refetch: refetchSystemStatus } = useSystemStatus();
  const { data: activeSolvingSession, refetch: refetchSolvingSession } = useActiveSolvingSession();
  const { data: cfopSteps } = useCFOPSteps();
  const { data: learningProgress } = useLearningProgress();

  // Mutations
  const { mutate: updateSystemStatus } = useFlaskMutation(apiClient.updateSystemStatus.bind(apiClient));
  const { mutate: processCubeImage } = useFlaskMutation(apiClient.processCubeImage.bind(apiClient));

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
      // You might want to validate the token here
    }
  }, []);

  // Update system status when mode changes
  useEffect(() => {
    if (currentMode === 'solving' || currentMode === 'learning') {
      updateSystemStatus({ currentMode });
    }
  }, [currentMode]);

  // Polling for real-time updates (replace with WebSocket in production)
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        refetchSolvingSession();
        refetchSystemStatus();
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentMode('selection');
  };

  const handleModeSelect = (mode: 'solving' | 'learning') => {
    console.log(`[DEBUG] Mode selected: ${mode} - releasing robot arms`);
    
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
  };

  const handleBackToSelection = () => {
    setCurrentMode('selection');
    setScannedFaces({});
    setScanningFace(null);
  };

  const handleStartScanning = () => {
    setCurrentMode('scanning');
    setScanningFace('top');
    setScannedFaces({});
  };

  const handleImageCapture = async (imageData: string, face: string) => {
    setIsProcessing(true);
    
    try {
      const result = await processCubeImage(imageData, face, activeSolvingSession?._id);
      
      setScannedFaces(prev => ({
        ...prev,
        [face]: result.faceColors
      }));

      // Move to next face or complete scanning
      const faceOrder = ['top', 'right', 'front', 'bottom', 'left', 'back'];
      const currentIndex = faceOrder.indexOf(face);
      
      if (currentIndex < faceOrder.length - 1) {
        setScanningFace(faceOrder[currentIndex + 1]);
      } else {
        setCurrentMode('solving');
        setScanningFace(null);
      }
    } catch (error) {
      console.error('Failed to process image:', error);
    } finally {
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

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

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
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
              >
                Logout
              </button>
            </div>
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
            activeSolvingSession={activeSolvingSession}
            systemStatus={systemStatus}
            scannedFaces={scannedFaces}
            onStartScanning={handleStartScanning}
          />
        )}
        
        {currentMode === 'learning' && (
          <LearningMode 
            cfopSteps={cfopSteps}
            learningProgress={learningProgress}
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
    </div>
  );
}

// Simple login form component
function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await onLogin(email, password);
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-1">CUBOT</h1>
          <p className="text-sm text-white/60 mb-2">by Bizards</p>
          <p className="text-white/70">Rubik's Cube Scanner & Solver</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-blue-400"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-blue-400"
              required
            />
          </div>
          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white rounded-xl font-medium transition-all"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default FlaskApp;
