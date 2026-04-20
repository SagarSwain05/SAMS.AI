/**
 * RecognitionControls — Campus-wide recognition server controls
 *
 * Supports two modes:
 *   1. Camera mode (localhost): server opens local webcam
 *   2. Headless mode (cloud):   client sends webcam frames via IoT endpoint
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Radio, Users, Clock, Camera, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

import { API_BASE as API, SOCKET_URL } from '../config';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

interface RecognitionControlsProps {
  onSessionStart?: () => void;
  onSessionStop?: () => void;
  onRecognitionUpdate?: (results: unknown[]) => void;
}

const RecognitionControls: React.FC<RecognitionControlsProps> = ({
  onSessionStart,
  onSessionStop,
}) => {
  const [status, setStatus]         = useState<{ college_session_active: boolean; present_count?: number; uptime_seconds?: number; live_feed_url?: string } | null>(null);
  const [loading, setLoading]       = useState(false);
  const [currentSlot, setSlot]      = useState<{ label: string; start_time: string; end_time: string } | null>(null);
  const [cameraSource, setSource]   = useState('0');
  const [isHeadless, setIsHeadless] = useState(false);
  const [iotEndpoint, setIotEndpoint] = useState<string | null>(null);
  const [streaming, setStreaming]   = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef    = useRef<ReturnType<typeof io> | null>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async (silent = false) => {
    try {
      const d = await apiFetch('/v2/recognition/college/status');
      setStatus(d);
    } catch {
      if (!silent) setStatus(null);
    }
  };

  const fetchSlot = async () => {
    try {
      const d = await apiFetch('/timetable/current');
      if (d.active_slot) setSlot(d.active_slot);
      else setSlot(null);
    } catch { /* weekend / no slot */ }
  };

  useEffect(() => {
    fetchStatus();
    fetchSlot();
    pollRef.current = setInterval(() => {
      fetchStatus(true);
      fetchSlot();
    }, 5000);

    const token = localStorage.getItem('token') || '';
    const sock = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    sock.on('connect', () => { sock.emit('watch_recognition'); });
    sock.on('recognition_auto_stopped', () => {
      toast('Recognition stopped — all viewers disconnected', { icon: '⏹' });
      fetchStatus();
      stopWebcamStream();
    });
    socketRef.current = sock;

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (socketRef.current) {
        socketRef.current.emit('unwatch_recognition');
        socketRef.current.disconnect();
      }
      stopWebcamStream();
    };
  }, []);

  // ── Headless webcam streaming ─────────────────────────────────────────────

  const stopWebcamStream = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
    setFrameCount(0);
  }, []);

  const startWebcamStream = useCallback(async (endpoint: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);

      // Send a frame every 500ms (2fps is enough for recognition)
      frameTimerRef.current = setInterval(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        canvas.width  = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, 640, 480);

        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            const form = new FormData();
            form.append('frame', blob, 'frame.jpg');
            await fetch(`${API}${endpoint}`, {
              method: 'POST',
              headers: authHeader(),
              body: form,
            });
            setFrameCount(c => c + 1);
          } catch { /* silent — best effort */ }
        }, 'image/jpeg', 0.7);
      }, 500);

      toast.success('Webcam connected — sending frames for recognition');
    } catch (err: any) {
      toast.error(`Webcam error: ${err.message}`);
    }
  }, []);

  // ── Session control ───────────────────────────────────────────────────────

  const handleStart = async () => {
    setLoading(true);
    try {
      const source = isNaN(Number(cameraSource)) ? cameraSource : Number(cameraSource);
      const result = await apiFetch('/v2/recognition/college/start', {
        method: 'POST',
        body: JSON.stringify({ source, recognition_interval: 3.0 }),
      });
      const headless = result.headless === true;
      setIsHeadless(headless);
      const iot = result.iot_endpoint || null;
      setIotEndpoint(iot);

      if (headless && iot) {
        toast.success('Recognition server started in headless mode — connecting webcam…');
        await startWebcamStream(iot);
      } else {
        toast.success('College recognition server started!');
      }
      await fetchStatus();
      onSessionStart?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      stopWebcamStream();
      await apiFetch('/v2/recognition/college/stop', { method: 'POST' });
      toast.success('Recognition server stopped.');
      setStatus({ college_session_active: false } as any);
      setIsHeadless(false);
      setIotEndpoint(null);
      onSessionStop?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isActive = status?.college_session_active ?? false;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Recognition Server</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Campus-wide · timetable-driven attendance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
              <span className="text-sm font-semibold text-green-600">LIVE</span>
              {isHeadless && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium ml-1">
                  Headless
                </span>
              )}
            </>
          ) : (
            <>
              <span className="h-3 w-3 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-500">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Current slot info */}
      <div className={`rounded-lg p-4 flex items-start gap-3 ${currentSlot ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
        <Clock className={`h-5 w-5 mt-0.5 ${currentSlot ? 'text-blue-600' : 'text-gray-400'}`} />
        <div>
          <p className={`text-sm font-semibold ${currentSlot ? 'text-blue-800' : 'text-gray-500'}`}>
            {currentSlot ? `${currentSlot.label} · ${currentSlot.start_time} – ${currentSlot.end_time}` : 'No class currently scheduled'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {currentSlot
              ? 'When recognition starts, attendance will be marked for this slot.'
              : 'Recognition can still run; attendance will be marked when a slot is active.'}
          </p>
        </div>
      </div>

      {/* Stats when active */}
      {isActive && status && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Present Today</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{status.present_count ?? 0}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="h-4 w-4 text-indigo-600 animate-pulse" />
              <span className="text-xs font-medium text-indigo-600">Uptime</span>
            </div>
            <p className="text-2xl font-bold text-indigo-700">
              {Math.floor((status.uptime_seconds ?? 0) / 60)}m
            </p>
          </div>
        </div>
      )}

      {/* Headless mode: webcam preview */}
      {isActive && isHeadless && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">
              Client Webcam — Sending Frames to Server
            </span>
            {streaming && (
              <span className="ml-auto text-xs text-blue-600 font-mono">
                {frameCount} frames sent
              </span>
            )}
          </div>
          {streaming ? (
            <div className="relative rounded overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <span className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded font-bold animate-pulse">
                LIVE
              </span>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-100 rounded-lg p-6 border-2 border-dashed border-blue-300 hover:border-blue-500 transition-colors"
              onClick={() => iotEndpoint && startWebcamStream(iotEndpoint)}
            >
              <Upload className="h-8 w-8 text-blue-400" />
              <p className="text-sm text-blue-600 font-medium">Click to connect webcam</p>
              <p className="text-xs text-gray-500">Frames are sent to the recognition server for processing</p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Camera source (only shown when inactive) */}
      {!isActive && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Camera Source</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={cameraSource}
            onChange={e => setSource(e.target.value)}
            placeholder="0 = webcam, or rtsp://ip/stream"
          />
          <p className="text-xs text-gray-400 mt-1">
            0 = server webcam · On cloud, headless mode activates automatically
          </p>
        </div>
      )}

      {/* Start / Stop button */}
      {!isActive ? (
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4
                     bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold
                     transition-all disabled:opacity-50"
        >
          {loading
            ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            : <><Play className="h-5 w-5" /> Start College Recognition</>}
        </button>
      ) : (
        <button
          onClick={handleStop}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4
                     bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold
                     transition-all disabled:opacity-50"
        >
          {loading
            ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            : <><Square className="h-5 w-5" /> Stop Recognition Server</>}
        </button>
      )}

      <p className="text-xs text-gray-400 text-center">
        When active, the kiosk platform also goes live automatically.
      </p>
    </div>
  );
};

export default RecognitionControls;
