/**
 * RecognitionControls — Campus-wide recognition server controls
 *
 * Replaces the old "select subject → start" flow.
 * Admin clicks "Start College Recognition" and the system:
 *   1. Opens the camera (source 0 by default)
 *   2. Recognises every face
 *   3. Auto-resolves each student's current subject from the live timetable
 *   4. Marks attendance without any manual subject selection
 */
import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Radio, Users, Clock } from 'lucide-react';
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
  const [status, setStatus]       = useState<{ college_session_active: boolean; present_count?: number; uptime_seconds?: number; live_feed_url?: string } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [currentSlot, setSlot]    = useState<{ label: string; start_time: string; end_time: string } | null>(null);
  const [cameraSource, setSource] = useState('0');
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

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

    // Register as recognition watcher via Socket.IO
    const token = localStorage.getItem('token') || '';
    const sock = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    sock.on('connect', () => {
      sock.emit('watch_recognition');
    });
    sock.on('recognition_auto_stopped', () => {
      toast('Recognition stopped — all viewers disconnected', { icon: '⏹' });
      fetchStatus();
    });
    socketRef.current = sock;

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (socketRef.current) {
        socketRef.current.emit('unwatch_recognition');
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      const source = isNaN(Number(cameraSource)) ? cameraSource : Number(cameraSource);
      await apiFetch('/v2/recognition/college/start', {
        method: 'POST',
        body: JSON.stringify({ source, recognition_interval: 3.0 }),
      });
      toast.success('College recognition server started!');
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
      await apiFetch('/v2/recognition/college/stop', { method: 'POST' });
      toast.success('Recognition server stopped.');
      setStatus({ active: false });
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
          <p className="text-xs text-gray-400 mt-1">0 = built-in webcam</p>
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
