/**
 * RecognitionKiosk — Public attendance display terminal
 *
 * Dual role:
 *   1. Display: shows annotated server MJPEG feed (faces + names) + attendance list
 *   2. Camera source: when server is in headless mode, captures webcam frames
 *      and sends to IoT endpoint so recognition runs on this device's camera
 *
 * Key fix: <video ref={videoRef}> and <canvas ref={canvasRef}> are ALWAYS in the DOM.
 * Previously the video was inside {webcamActive && (...)} so videoRef.current was null
 * when getUserMedia resolved → srcObject never set → readyState = 0 →
 * toBlob never called → no frames ever sent to server.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Users, CheckCircle, Clock, Wifi, WifiOff, Video } from 'lucide-react';
import { io } from 'socket.io-client';

import { SOCKET_URL as BACKEND, API_BASE } from '../config';

interface Attendee { name: string; roll_number: string; }

interface PublicStatus {
  active: boolean;
  section_id?: number;
  section_label?: string;
  subject_label?: string;
  live_feed_url?: string;
  present_count?: number;
  recent_attendees?: Attendee[];
  message?: string;
  headless?: boolean;
  iot_endpoint?: string;
}

const RecognitionKiosk: React.FC = () => {
  const [status, setStatus]           = useState<PublicStatus>({ active: false });
  const [isConnected, setIsConnected] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate]   = useState(new Date());
  const [webcamActive, setWebcamActive] = useState(false);

  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef     = useRef<ReturnType<typeof io> | null>(null);

  // CRITICAL: These refs must be on elements ALWAYS in the DOM.
  // Previously videoRef was inside {webcamActive && (...)} which meant
  // videoRef.current was null when getUserMedia resolved. The stream was obtained
  // but srcObject was never set → readyState = 0 → toBlob never called → 0 frames.
  const videoRef      = useRef<HTMLVideoElement>(null);   // hidden capture element
  const canvasRef     = useRef<HTMLCanvasElement>(null);  // hidden frame extraction

  const streamRef     = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iotRef        = useRef<string | null>(null);

  // ── Webcam streaming (background — sends frames to server's IoT endpoint) ──

  const stopWebcam = useCallback(() => {
    if (frameTimerRef.current) { clearInterval(frameTimerRef.current); frameTimerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    iotRef.current = null;
    setWebcamActive(false);
  }, []);

  const startWebcam = useCallback(async (endpoint: string) => {
    if (streamRef.current) return; // already running
    iotRef.current = endpoint;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;

      // videoRef is on a hidden element ALWAYS in the DOM — guaranteed non-null.
      // This is the critical fix: srcObject is set before setWebcamActive(true)
      // so the video is already playing when frame capture starts.
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setWebcamActive(true);

      // Send frames at 2fps — enough for ArcFace recognition
      frameTimerRef.current = setInterval(() => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        const ep     = iotRef.current;
        if (!video || !canvas || !ep || video.readyState < 2) return;

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
            await fetch(`${API_BASE}${ep}`, { method: 'POST', body: form });
          } catch { /* best effort */ }
        }, 'image/jpeg', 0.72);
      }, 500);

    } catch (err: any) {
      console.warn('Kiosk webcam:', err.message);
      // Silent fail — display still works from server MJPEG
    }
  }, []);

  // ── Polling + socket ────────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    try {
      const res  = await fetch(`${BACKEND}/api/v2/recognition/public_status`);
      const data: PublicStatus = await res.json();
      setStatus(data);
      setIsConnected(true);
      if (data.active) setLastUpdate(new Date());

      // Auto-start webcam when server enters headless mode
      if (data.active && data.iot_endpoint && !streamRef.current) {
        startWebcam(data.iot_endpoint);
      }
      // Stop webcam when session ends
      if (!data.active && streamRef.current) {
        stopWebcam();
      }
    } catch {
      setIsConnected(false);
    }
  }, [startWebcam, stopWebcam]);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 3000);

    const sock = io(BACKEND, { transports: ['websocket', 'polling'] });
    sock.on('connect', () => { sock.emit('watch_recognition'); });
    socketRef.current = sock;

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (socketRef.current) { socketRef.current.emit('unwatch_recognition'); socketRef.current.disconnect(); }
      stopWebcam();
    };
  }, []);

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Server MJPEG feed — shows annotated faces with names/boxes from AI processing
  const feedUrl = status.active && status.live_feed_url
    ? `${BACKEND}${status.live_feed_url}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 text-white flex flex-col">

      {/*
        ALWAYS-PRESENT hidden elements for webcam frame capture.
        These must be outside all conditional renders so refs are always valid.
        The "Your cam" display below uses a SEPARATE video with a ref callback.
      */}
      <video ref={videoRef} autoPlay muted playsInline className="hidden" aria-hidden="true" />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Header */}
      <div className="bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="px-8 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
              <Camera className="h-10 w-10" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-0.5">
                Trident Academy of Technology
              </p>
              <h1 className="text-3xl font-bold tracking-tight">Attendance Kiosk</h1>
              <p className="text-sm text-gray-300 mt-1">
                {status.active
                  ? `${status.section_label || ''} · ${status.subject_label || ''}`
                  : 'AI-Powered Face Recognition System · Bhubaneswar, Odisha'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            {/* Connection */}
            <div className="flex items-center gap-2">
              {isConnected
                ? <><Wifi className="h-5 w-5 text-green-400" /><span className="text-sm text-green-400">Connected</span></>
                : <><WifiOff className="h-5 w-5 text-red-400" /><span className="text-sm text-red-400">Disconnected</span></>}
            </div>

            {/* Webcam sending indicator */}
            {webcamActive && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 border border-cyan-400/40 rounded-full">
                <Video className="h-4 w-4 text-cyan-400 animate-pulse" />
                <span className="text-xs text-cyan-300 font-medium">Webcam → Server</span>
              </div>
            )}

            {/* Session status */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/10 border border-white/20">
              {status.active ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                  </span>
                  <span className="text-sm font-semibold text-green-400">LIVE</span>
                  <span className="text-sm text-gray-300">{status.present_count ?? 0} present</span>
                </>
              ) : (
                <>
                  <span className="h-3 w-3 rounded-full bg-gray-500" />
                  <span className="text-sm font-semibold text-gray-400">INACTIVE</span>
                </>
              )}
            </div>

            {/* Clock */}
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">{fmtTime(currentTime)}</div>
              <div className="text-xs text-gray-300">{fmtDate(currentTime)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[calc(100vh-200px)]">

          {/* Primary display: Server annotated MJPEG feed */}
          <div className="lg:col-span-2 bg-black/40 backdrop-blur-md rounded-2xl border-2 border-white/10 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera className="h-6 w-6" />
                <span className="font-semibold text-lg">Live Recognition Feed</span>
              </div>
              <div className="flex items-center gap-2">
                {webcamActive && (
                  <span className="text-xs bg-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-full">
                    Webcam → Server
                  </span>
                )}
                {status.active && (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Recording</span>
                )}
              </div>
            </div>

            <div className="flex-1 relative bg-gray-900 flex items-center justify-center min-h-[300px]">
              {feedUrl ? (
                <img
                  src={feedUrl}
                  alt="Live Recognition Feed"
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="text-center p-12">
                  <Camera className="h-24 w-24 mx-auto mb-6 text-gray-600" />
                  <p className="text-xl font-semibold text-gray-400 mb-2">
                    Recognition System Inactive
                  </p>
                  <p className="text-sm text-gray-500">
                    Waiting for admin to start a recognition session...
                  </p>
                </div>
              )}

              {/*
                "Your cam" preview — a SEPARATE display video.
                Uses a ref callback to get the stream from streamRef when rendered.
                This is distinct from the always-present hidden capture video above.
              */}
              {webcamActive && (
                <div className="absolute bottom-3 right-3 w-32 h-24 rounded-lg overflow-hidden border-2 border-cyan-400/60 shadow-lg">
                  <video
                    autoPlay muted playsInline
                    className="w-full h-full object-cover"
                    ref={(el) => {
                      if (el && streamRef.current && !el.srcObject) {
                        el.srcObject = streamRef.current;
                      }
                    }}
                  />
                  <div className="absolute top-0 left-0 right-0 bg-cyan-600/80 text-white text-xs text-center py-0.5">
                    Your cam
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attendance panel */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border-2 border-white/10 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6" />
                <span className="font-semibold text-lg">Attendance</span>
              </div>
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                {status.present_count ?? 0} marked
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!status.active ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">No active session</p>
                  <p className="text-sm text-gray-500 mt-2">Admin will start a session shortly</p>
                </div>
              ) : !status.recent_attendees?.length ? (
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-gray-600 animate-pulse" />
                  <p className="text-gray-400">Scanning for faces...</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {webcamActive ? 'Look at the camera to mark attendance' : 'Please face the camera'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...(status.recent_attendees || [])].reverse().map((s, i) => (
                    <div key={i}
                      className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-xl p-4 flex items-center gap-3">
                      <div className="p-2 bg-green-500 rounded-lg flex-shrink-0">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-base truncate">{s.name}</p>
                        <p className="text-xs text-gray-300">{s.roll_number}</p>
                      </div>
                      <span className="ml-auto flex-shrink-0 text-green-400 text-xs font-medium">Present</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-white/5 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Clock className="h-4 w-4" />
                <span>Updated: {fmtTime(lastUpdate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black/40 backdrop-blur-md border-t border-white/10 px-8 py-3">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>AI-Powered Student Attendance System</span>
          <span>Kiosk Mode · Public Display</span>
        </div>
      </div>
    </div>
  );
};

export default RecognitionKiosk;
