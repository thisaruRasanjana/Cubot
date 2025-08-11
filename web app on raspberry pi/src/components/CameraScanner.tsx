import React, { useRef, useEffect, useState } from 'react';

interface CameraScannerProps {
  currentFace: string;
  scannedFaces: Record<string, string>;
  isProcessing: boolean;
  onImageCapture: (imageData: string, face: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}

const CameraScanner: React.FC<CameraScannerProps> = ({
  currentFace,
  scannedFaces,
  isProcessing,
  onImageCapture,
  onComplete,
  onCancel
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState(0);

  const faceInstructions = {
    top: "Hold the cube with the top face towards the camera",
    right: "Show the right side of the cube",
    front: "Hold the cube with the front face towards the camera",
    bottom: "Tilt the cube to show the bottom face",
    left: "Show the left side of the cube",
    back: "Rotate the cube to show the back face"
  };

  const faceOrder = ['top', 'right', 'front', 'bottom', 'left', 'back'];
  const currentIndex = faceOrder.indexOf(currentFace);
  const progress = ((Object.keys(scannedFaces).length) / 6) * 100;

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Keyboard shortcuts for quick interaction
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        captureImage();
      } else if (event.code === 'KeyG') {
        event.preventDefault();
        toggleGrid();
      } else if (event.code === 'Escape') {
        event.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isProcessing, hasPermission, isVideoReady]);

  const startCamera = async () => {
    try {
      console.log('Starting camera...');
      
      // Use lower quality settings for better performance
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained');
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, camera ready');
          setIsVideoReady(true);
        };
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
      }
      setHasPermission(true);
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      setError('Camera access denied. Please allow camera permissions and try again.');
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped');
      });
      streamRef.current = null;
    }
    setIsVideoReady(false);
  };

  const captureImage = () => {
    const now = Date.now();
    if (now - lastCaptureTime < 500) {
      console.log('Capture debounced - too soon since last capture');
      return;
    }
    
    if (!videoRef.current || !canvasRef.current || isProcessing || !isVideoReady) {
      console.log('Cannot capture - missing requirements:', {
        video: !!videoRef.current,
        canvas: !!canvasRef.current,
        processing: isProcessing,
        videoReady: isVideoReady
      });
      return;
    }
    
    try {
      console.log(`Starting image capture for face: ${currentFace}`);
      setLastCaptureTime(now);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Invalid video dimensions or context');
      }

      // Calculate the cube face area dimensions
      const videoAspect = video.videoWidth / video.videoHeight;
      const targetSize = Math.min(video.videoWidth, video.videoHeight) * 0.6; // 60% of smaller dimension
      
      // Calculate source coordinates (center of the video)
      const sourceX = (video.videoWidth - targetSize) / 2;
      const sourceY = (video.videoHeight - targetSize) / 2;
      
      // Set canvas size to desired output size (square)
      const outputSize = 300; // Fixed size for cube face
      canvas.width = outputSize;
      canvas.height = outputSize;

      // Clear canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, outputSize, outputSize);

      // Draw only the cube face area
      ctx.drawImage(
        video,
        sourceX, sourceY, // Source position (center of video)
        targetSize, targetSize, // Source dimensions (square)
        0, 0, // Destination position
        outputSize, outputSize // Destination dimensions
      );

      // Convert to JPEG with good quality
      const imageData = canvas.toDataURL('image/jpeg', 0.85);
      
      console.log(`Image captured successfully:`, {
        face: currentFace,
        dimensions: `${outputSize}x${outputSize}`,
        sourceArea: `${Math.round(targetSize)}x${Math.round(targetSize)} from ${Math.round(sourceX)},${Math.round(sourceY)}`
      });
      
      if (!imageData || !imageData.startsWith('data:image/jpeg')) {
        throw new Error('Invalid image format - expected JPEG');
      }
      
      onImageCapture(imageData, currentFace);
    } catch (error) {
      console.error('Image capture failed:', error);
      alert('Failed to capture image - please try again');
    }
  };

  const handleCancel = () => {
    console.log('Camera scanner cancelled');
    stopCamera();
    onCancel();
  };

  const toggleGrid = () => {
    setShowGrid(prev => !prev);
    console.log(`Grid toggled: ${!showGrid}`);
  };

  // Optimize video performance on mount
  useEffect(() => {
    if (videoRef.current && isVideoReady) {
      const video = videoRef.current;
      
      // Reduce video processing overhead
      video.style.willChange = 'auto';
      video.style.transform = 'translateZ(0)'; // Hardware acceleration
      
      // Optimize for mobile
      if (/Mobi|Android/i.test(navigator.userAgent)) {
        video.style.webkitTransform = 'translateZ(0)';
        video.style.webkitBackfaceVisibility = 'hidden';
      }
    }
  }, [isVideoReady]);

  if (hasPermission === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center mx-auto">
          <div className="text-3xl sm:text-4xl mb-4">📷</div>
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">Camera Access Required</h2>
          <p className="text-white/70 mb-6 text-sm sm:text-base">{error}</p>
          <div className="space-y-3">
            <button
              onClick={startCamera}
              className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl font-medium transition-all text-sm sm:text-base min-h-[48px] touch-manipulation"
            >
              Try Again
            </button>
            <button
              onClick={handleCancel}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border border-white/20 rounded-xl font-medium transition-all text-sm sm:text-base min-h-[48px] touch-manipulation"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 md:px-8 lg:px-0">
      {/* Header - Compact on mobile */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-3 sm:p-4 mb-3 sm:mb-4 w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-white">Scanning: {currentFace.toUpperCase()}</h2>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isVideoReady ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
              <span className="text-white/60 text-xs">{isVideoReady ? 'Ready' : 'Loading'}</span>
            </div>
            <button
              onClick={toggleGrid}
              className={`p-1.5 sm:p-2 rounded-lg transition-all duration-150 text-xs sm:text-sm touch-manipulation ${
                showGrid 
                  ? 'bg-blue-500 text-white shadow-lg' 
                  : 'bg-white/10 text-white/70 hover:bg-white/20 active:bg-white/30'
              }`}
              title={showGrid ? 'Hide grid (G)' : 'Show grid (G)'}
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
            >
              ⊞
            </button>
            <span className="text-white/70 text-xs sm:text-sm">{currentIndex + 1}/6</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden mb-2 sm:mb-3">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-white/80 text-xs sm:text-sm text-center leading-tight">
          {faceInstructions[currentFace as keyof typeof faceInstructions]}
        </p>
      </div>

      {/* Camera View - Perfectly centered responsive container */}
      <div className="flex-1 relative bg-black rounded-xl sm:rounded-2xl overflow-hidden min-h-0 camera-container w-full max-w-4xl mx-auto">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'translateZ(0)',
            willChange: isVideoReady ? 'auto' : 'transform',
            backfaceVisibility: 'hidden'
          }}
        />
        
        {/* Overlay Guide - Responsive sizing */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 sm:p-6 md:p-8">
          <div className="w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 border-4 border-white/50 rounded-xl sm:rounded-2xl relative max-w-[75vw] max-h-[55vh] cube-guide">
            <div className="absolute -top-6 sm:-top-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm whitespace-nowrap">
              Align cube face here
            </div>
            
            {/* Corner guides - Responsive sizing */}
            <div className="absolute -top-1.5 sm:-top-2 -left-1.5 sm:-left-2 w-4 h-4 sm:w-6 sm:h-6 border-t-2 sm:border-t-4 border-l-2 sm:border-l-4 border-white"></div>
            <div className="absolute -top-1.5 sm:-top-2 -right-1.5 sm:-right-2 w-4 h-4 sm:w-6 sm:h-6 border-t-2 sm:border-t-4 border-r-2 sm:border-r-4 border-white"></div>
            <div className="absolute -bottom-1.5 sm:-bottom-2 -left-1.5 sm:-left-2 w-4 h-4 sm:w-6 sm:h-6 border-b-2 sm:border-b-4 border-l-2 sm:border-l-4 border-white"></div>
            <div className="absolute -bottom-1.5 sm:-bottom-2 -right-1.5 sm:-right-2 w-4 h-4 sm:w-6 sm:h-6 border-b-2 sm:border-b-4 border-r-2 sm:border-r-4 border-white"></div>
            
            {/* 3x3 Grid Overlay */}
            <div className={`absolute inset-0 grid-overlay ${showGrid ? 'grid-visible' : 'grid-hidden'}`}>
              {/* Vertical lines */}
              <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-white/40 grid-line"></div>
              <div className="absolute top-0 bottom-0 left-2/3 w-0.5 bg-white/40 grid-line"></div>
              
              {/* Horizontal lines */}
              <div className="absolute left-0 right-0 top-1/3 h-0.5 bg-white/40 grid-line"></div>
              <div className="absolute left-0 right-0 top-2/3 h-0.5 bg-white/40 grid-line"></div>
            </div>
          </div>
        </div>

        {/* Processing Overlay - Responsive */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center max-w-xs">
              <div className="animate-spin w-6 h-6 sm:w-8 sm:h-8 border-2 sm:border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3 sm:mb-4"></div>
              <p className="text-white font-medium text-sm sm:text-base">Processing image...</p>
              <p className="text-white/60 text-xs mt-2">Face: {currentFace}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls - Touch-friendly and responsive */}
      <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-3 pb-4 sm:pb-0 w-full max-w-4xl mx-auto">
        <button
          onClick={handleCancel}
          className="order-2 sm:order-1 flex-1 px-4 py-3 sm:py-3 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border border-white/20 rounded-xl font-medium transition-all duration-150 text-sm sm:text-base min-h-[48px] touch-manipulation"
          style={{ 
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation'
          }}
        >
          Cancel (Esc)
        </button>
        <button
          onClick={captureImage}
          disabled={isProcessing || !hasPermission || !isVideoReady}
          className="order-1 sm:order-2 flex-2 px-6 py-3 sm:py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all duration-150 text-sm sm:text-base min-h-[48px] touch-manipulation transform active:scale-95"
          style={{ 
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation'
          }}
        >
          {isProcessing ? 'Processing...' : !isVideoReady ? 'Loading Camera...' : `Capture ${currentFace.toUpperCase()} Face (Space)`}
        </button>
      </div>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraScanner;
