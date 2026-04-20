import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { recognitionAPI } from '../services/api';
import type { RecognitionResult } from '../types';

interface CameraFeedProps {
  isActive: boolean;
  onRecognitionResults?: (results: RecognitionResult[]) => void;
  showOverlay?: boolean;
  className?: string;
}

/**
 * CameraFeed component for displaying MJPEG video stream with face recognition
 */
const CameraFeed: React.FC<CameraFeedProps> = ({
  isActive,
  onRecognitionResults,
  showOverlay = true,
  className = '',
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognitionResults, setRecognitionResults] = useState<RecognitionResult[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Poll recognition status to get latest detections
   */
  const pollRecognitionStatus = async () => {
    if (!isActive) return;

    try {
      const status = await recognitionAPI.getStatus();

      if (status.current_detections) {
        setRecognitionResults(status.current_detections);

        // Notify parent component
        if (onRecognitionResults) {
          onRecognitionResults(status.current_detections);
        }
      }
    } catch (err) {
      console.error('Failed to poll recognition status:', err);
    }
  };

  /**
   * Start polling for recognition results
   */
  useEffect(() => {
    if (isActive) {
      // Poll every 1 second
      pollIntervalRef.current = setInterval(pollRecognitionStatus, 1000);
    } else {
      // Clear interval when inactive
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setRecognitionResults([]);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isActive, onRecognitionResults]);

  /**
   * Handle image load success
   */
  const handleImageLoad = () => {
    setIsConnected(true);
    setError(null);
  };

  /**
   * Handle image load error
   */
  const handleImageError = () => {
    setIsConnected(false);
    setError('Failed to connect to camera feed');
  };

  /**
   * Get video feed URL with cache buster
   */
  const getVideoFeedUrl = () => {
    if (!isActive) return '';
    // Add timestamp to prevent caching
    return `${recognitionAPI.getVideoFeedUrl()}?t=${Date.now()}`;
  };

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Camera Feed */}
      {isActive ? (
        <div className="relative">
          <img
            ref={imgRef}
            src={getVideoFeedUrl()}
            alt="Camera Feed"
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="w-full h-full object-contain"
          />

          {/* Connection Status Indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-400" />
                <span className="text-xs text-white">Connected</span>
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-400" />
                <span className="text-xs text-white">Disconnected</span>
              </>
            )}
          </div>

          {/* Recognition Results Overlay */}
          {showOverlay && recognitionResults.length > 0 && (
            <div className="absolute top-4 left-4 max-w-xs">
              <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-white text-sm font-medium">
                  <Camera className="h-4 w-4" />
                  <span>Detected: {recognitionResults.length} {recognitionResults.length === 1 ? 'person' : 'people'}</span>
                </div>
                <div className="space-y-1">
                  {recognitionResults.slice(0, 5).map((result, index) => (
                    <div
                      key={index}
                      className="text-xs text-white/90 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        {result.student?.name || `Student #${result.student_id}`}
                      </span>
                      <span className="text-green-400 font-medium">
                        {(result.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  {recognitionResults.length > 5 && (
                    <div className="text-xs text-white/60">
                      +{recognitionResults.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-2" />
                <p className="text-white text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Inactive State
        <div className="aspect-video flex flex-col items-center justify-center text-gray-400 bg-gray-800">
          <Camera className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-sm">Camera Feed Inactive</p>
          <p className="text-xs mt-1 opacity-75">Start recognition to view feed</p>
        </div>
      )}

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span>{isActive ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          {recognitionResults.length > 0 && (
            <span className="text-green-400">
              {recognitionResults.length} detected
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraFeed;
