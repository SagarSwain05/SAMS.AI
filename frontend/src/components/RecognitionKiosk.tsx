import React, { useState, useEffect, useRef } from 'react';
import { Camera, Users, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { io } from 'socket.io-client';

import { SOCKET_URL as BACKEND } from '../config';

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
}

const RecognitionKiosk: React.FC = () => {
  const [status, setStatus]           = useState<PublicStatus>({ active: false });
  const [isConnected, setIsConnected] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate]   = useState(new Date());
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  // Poll V2 public status every 3 s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/v2/recognition/public_status`);
        const data: PublicStatus = await res.json();
        setStatus(data);
        setIsConnected(true);
        if (data.active) setLastUpdate(new Date());
      } catch {
        setIsConnected(false);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);

    // Register kiosk as recognition watcher so backend auto-stops when kiosk closes
    const sock = io(BACKEND, { transports: ['websocket', 'polling'] });
    sock.on('connect', () => { sock.emit('watch_recognition'); });
    socketRef.current = sock;

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (socketRef.current) {
        socketRef.current.emit('unwatch_recognition');
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const feedUrl = status.active && status.live_feed_url
    ? `${BACKEND}${status.live_feed_url}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="px-8 py-4 flex items-center justify-between">
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

          <div className="flex items-center gap-8">
            {/* Connection */}
            <div className="flex items-center gap-2">
              {isConnected
                ? <><Wifi className="h-6 w-6 text-green-400" /><span className="text-sm text-green-400">Connected</span></>
                : <><WifiOff className="h-6 w-6 text-red-400" /><span className="text-sm text-red-400">Disconnected</span></>}
            </div>

            {/* Session status badge */}
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
              <div className="text-3xl font-bold tabular-nums">{fmtTime(currentTime)}</div>
              <div className="text-sm text-gray-300">{fmtDate(currentTime)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[calc(100vh-200px)]">
          {/* Camera Feed */}
          <div className="lg:col-span-2 bg-black/40 backdrop-blur-md rounded-2xl border-2 border-white/10 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera className="h-6 w-6" />
                <span className="font-semibold text-lg">Live Feed</span>
              </div>
              {status.active && (
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Recording</span>
              )}
            </div>

            <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
              {feedUrl ? (
                <img
                  src={feedUrl}
                  alt="Live Camera Feed"
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
            </div>
          </div>

          {/* Attendance Panel */}
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
                  <p className="text-sm text-gray-500 mt-2">Please face the camera</p>
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

            {/* Last update footer */}
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
