/**
 * SystemHealth — Admin panel showing live status of every part of SAMS.AI
 * (backend, database, frontend, WebSocket, face recognition, API groups,
 * Hugging Face Space) with restart controls.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Activity, Database, Globe, Wifi, ScanFace, Server, Cloud, RefreshCw, Power, RotateCcw, Hammer,
} from 'lucide-react';

import { API_BASE as API } from '../config';
import { useSocket } from '../contexts/SocketContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SystemStatus {
  status: 'ok' | 'degraded';
  time: string;
  uptime_s: number;
  components: {
    backend: { ok: boolean; pid: number; memory_mb: number | null };
    database: { ok: boolean; latency_ms?: number; error?: string };
    frontend: { ok: boolean };
    face_recognition: { ok: boolean; engine_ready?: boolean; students_enrolled?: number; active_streams?: number; error?: string };
  };
  controls: { worker_restart: boolean; space_restart: boolean; space_id: string | null };
}

interface SpaceRuntime { available: boolean; stage?: string; hardware?: string; error?: string; message?: string; }

interface ProbeResult { name: string; path: string; ok: boolean | null; code?: number; ms?: number; }

type RestartTarget = 'database' | 'worker' | 'space' | 'space_rebuild';

// One cheap, read-only GET per API group
const API_PROBES: { name: string; path: string }[] = [
  { name: 'Auth',              path: '/auth/verify' },
  { name: 'Students',          path: '/students?search=__health_probe__' },
  { name: 'Teachers',          path: '/teachers' },
  { name: 'Users',             path: '/users?role=admin' },
  { name: 'Branches',          path: '/branches' },
  { name: 'Sections',          path: '/sections' },
  { name: 'Subjects',          path: '/subjects' },
  { name: 'Timetable',         path: '/timetable/slots' },
  { name: 'Attendance',        path: '/attendance?date_from=2099-01-01' },
  { name: 'Recognition (v1)',  path: '/recognition/model_info' },
  { name: 'Recognition (v2)',  path: '/v2/recognition/active_streams' },
  { name: 'Admin utilities',   path: '/admin/seed-status' },
];

const REFRESH_MS = 15000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function timedFetch(path: string, opts: RequestInit = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts.headers || {}) },
    });
    const json = await res.json().catch(() => ({}));
    return { res, json, ms: Math.round(performance.now() - t0) };
  } finally {
    clearTimeout(timer);
  }
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

const Dot: React.FC<{ ok: boolean | null | undefined }> = ({ ok }) => (
  <span className={`inline-block h-2.5 w-2.5 rounded-full ${
    ok === null || ok === undefined ? 'bg-gray-300 animate-pulse' : ok ? 'bg-green-500' : 'bg-red-500'
  }`} />
);

const Card: React.FC<{ icon: React.ReactNode; title: string; ok: boolean | null | undefined; detail: React.ReactNode }> =
  ({ icon, title, ok, detail }) => (
    <div className={`bg-white rounded-xl border p-4 ${ok === false ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">{icon}{title}</div>
        <div className="flex items-center gap-1.5 text-xs">
          <Dot ok={ok} />
          <span className={ok === false ? 'text-red-600' : ok ? 'text-green-700' : 'text-gray-400'}>
            {ok === null || ok === undefined ? 'Checking' : ok ? 'Healthy' : 'Down'}
          </span>
        </div>
      </div>
      <div className="text-xs text-gray-500 space-y-0.5">{detail}</div>
    </div>
  );

// ── Component ─────────────────────────────────────────────────────────────────

const SystemHealth: React.FC = () => {
  const { connected: socketConnected } = useSocket();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [space, setSpace] = useState<SpaceRuntime | null>(null);
  const [probes, setProbes] = useState<ProbeResult[]>(API_PROBES.map(p => ({ ...p, ok: null })));
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<RestartTarget | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const waitRef = useRef(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const { json } = await timedFetch('/system/status');
      if (json?.components) {
        setStatus(json as SystemStatus);
        setBackendReachable(true);
      } else {
        setBackendReachable(false);
      }
    } catch {
      setBackendReachable(false);
      setStatus(null);
    }

    timedFetch('/system/space').then(({ json }) => setSpace(json)).catch(() => setSpace(null));

    const results = await Promise.all(API_PROBES.map(async p => {
      try {
        const { res, ms } = await timedFetch(p.path);
        return { ...p, ok: res.ok, code: res.status, ms };
      } catch {
        return { ...p, ok: false };
      }
    }));
    setProbes(results);
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => { if (!waitRef.current) refresh(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  /** Poll /system/ping until the backend answers again (after a restart). */
  const waitUntilBack = async (label: string, initialDelayMs: number, maxMs: number) => {
    waitRef.current = true;
    setWaitingFor(label);
    const deadline = Date.now() + maxMs;
    await new Promise(r => setTimeout(r, initialDelayMs));
    while (Date.now() < deadline) {
      try {
        const { res } = await timedFetch('/system/ping', {}, 5000);
        if (res.ok) {
          toast.success(`${label} complete — system is back online`);
          break;
        }
      } catch { /* still restarting */ }
      await new Promise(r => setTimeout(r, 5000));
    }
    if (Date.now() >= deadline) toast.error(`${label} is taking longer than expected — check again shortly`);
    waitRef.current = false;
    setWaitingFor(null);
    refresh();
  };

  const restart = async (target: RestartTarget) => {
    const confirmText: Record<RestartTarget, string> = {
      database:      'Reset the database connection pool?',
      worker:        'Restart the backend worker? Active camera sessions will stop. The app is back in ~15 seconds.',
      space:         'Restart the entire Hugging Face Space? The whole app will be offline for ~2–5 minutes.',
      space_rebuild: 'Factory-rebuild the Space? This rebuilds the Docker image from scratch and takes ~10 minutes.',
    };
    if (!window.confirm(confirmText[target])) return;

    setBusy(target);
    try {
      const { res, json } = await timedFetch('/system/restart', { method: 'POST', body: JSON.stringify({ target }) }, 20000);
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      toast.success(json.message);
      if (target === 'worker') await waitUntilBack('Backend restart', 5000, 3 * 60_000);
      else if (target === 'space') await waitUntilBack('Space restart', 30_000, 10 * 60_000);
      else if (target === 'space_rebuild') await waitUntilBack('Space rebuild', 60_000, 20 * 60_000);
      else refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restart failed');
    } finally {
      setBusy(null);
    }
  };

  const c = status?.components;
  const apiOk = probes.every(p => p.ok !== false);
  const apiFailing = probes.filter(p => p.ok === false).length;
  const backendOk = backendReachable === null ? null : backendReachable && !!c?.backend.ok;
  const allOk = backendOk && c?.database.ok && c?.frontend.ok && socketConnected && apiOk;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" /> System Health
          </h2>
          <p className="text-sm text-gray-500">
            {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()} · auto-refresh every 15s` : 'Checking…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            waitingFor ? 'bg-amber-100 text-amber-800'
              : allOk ? 'bg-green-100 text-green-800'
              : backendReachable === null ? 'bg-gray-100 text-gray-600'
              : 'bg-red-100 text-red-800'
          }`}>
            {waitingFor ? `${waitingFor} in progress…` : allOk ? 'All systems operational'
              : backendReachable === null ? 'Checking…' : 'Issues detected'}
          </span>
          <button
            onClick={refresh}
            disabled={checking || !!waitingFor}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Component cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card icon={<Server className="h-4 w-4" />} title="Backend API" ok={backendOk} detail={c ? (
          <>
            <div>Uptime: {formatUptime(status!.uptime_s)}</div>
            <div>Worker PID {c.backend.pid}{c.backend.memory_mb ? ` · ${c.backend.memory_mb} MB RAM` : ''}</div>
          </>
        ) : backendReachable === false ? 'Backend is not responding' : null} />

        <Card icon={<Database className="h-4 w-4" />} title="Database (PostgreSQL)" ok={c ? c.database.ok : backendReachable === false ? false : null} detail={
          c?.database.ok ? <div>Query latency: {c.database.latency_ms} ms</div>
            : c?.database.error ? <div className="text-red-600 break-words">{c.database.error}</div> : null
        } />

        <Card icon={<Globe className="h-4 w-4" />} title="Frontend" ok={c ? c.frontend.ok : null} detail={
          <div>{c?.frontend.ok ? 'React build served by the backend' : 'frontend_dist not found on server'}</div>
        } />

        <Card icon={<Wifi className="h-4 w-4" />} title="WebSocket (live updates)" ok={socketConnected} detail={
          <div>{socketConnected ? 'Connected — real-time events flowing' : 'Disconnected — reconnecting automatically'}</div>
        } />

        <Card icon={<ScanFace className="h-4 w-4" />} title="Face Recognition (ArcFace)"
          ok={c ? (c.face_recognition.engine_ready ?? false) : null}
          detail={c ? (c.face_recognition.error ? <div className="text-red-600">{c.face_recognition.error}</div> : (
            <>
              <div>{c.face_recognition.engine_ready ? 'Model loaded' : 'Model loading / unavailable'}</div>
              <div>{c.face_recognition.students_enrolled ?? 0} students enrolled · {c.face_recognition.active_streams ?? 0} active streams</div>
            </>
          )) : null} />

        <Card icon={<Cloud className="h-4 w-4" />} title="Hugging Face Space"
          ok={space?.available ? space.stage === 'RUNNING' : space ? undefined : null}
          detail={space?.available ? (
            <>
              <div>Stage: <span className="font-medium">{space.stage}</span>{space.hardware ? ` · ${space.hardware}` : ''}</div>
              {space.error && <div className="text-red-600">{space.error}</div>}
            </>
          ) : <div>{space?.message ?? 'Checking…'}</div>} />
      </div>

      {/* API endpoints */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">API Endpoints</h3>
          <span className={`text-xs ${apiFailing ? 'text-red-600' : 'text-gray-500'}`}>
            {apiFailing ? `${apiFailing} of ${probes.length} failing` : `${probes.length} groups checked`}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0">
          {probes.map(p => (
            <div key={p.name} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Dot ok={p.ok} />
                <span className="text-gray-800">{p.name}</span>
                <code className="text-xs text-gray-400 truncate hidden md:inline">{p.path.split('?')[0]}</code>
              </div>
              <span className={`text-xs tabular-nums ${p.ok === false ? 'text-red-600' : 'text-gray-500'}`}>
                {p.ok === null ? '…' : p.code ? `${p.code} · ${p.ms} ms` : 'timeout'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Restart controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">Restart Controls</h3>
        <p className="text-xs text-gray-500 mb-4">
          Try the lightest fix first. Database and worker restarts take seconds; a Space restart takes a few minutes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            { target: 'database' as const, label: 'Reconnect Database', icon: <Database className="h-4 w-4" />,
              hint: 'Fixes stale or dropped DB connections', enabled: backendReachable === true, style: 'bg-indigo-600 hover:bg-indigo-700' },
            { target: 'worker' as const, label: 'Restart Backend', icon: <RotateCcw className="h-4 w-4" />,
              hint: 'Fresh backend process (~15s)', enabled: !!status?.controls.worker_restart, style: 'bg-amber-600 hover:bg-amber-700' },
            { target: 'space' as const, label: 'Restart Space', icon: <Power className="h-4 w-4" />,
              hint: 'Restarts the whole app (~2–5 min)', enabled: !!status?.controls.space_restart, style: 'bg-red-600 hover:bg-red-700' },
            { target: 'space_rebuild' as const, label: 'Factory Rebuild', icon: <Hammer className="h-4 w-4" />,
              hint: 'Rebuilds Docker image (~10 min)', enabled: !!status?.controls.space_restart, style: 'bg-gray-800 hover:bg-gray-900' },
          ]).map(b => (
            <div key={b.target}>
              <button
                onClick={() => restart(b.target)}
                disabled={!b.enabled || !!busy || !!waitingFor}
                className={`w-full flex items-center justify-center gap-2 text-white py-2 rounded-lg text-sm disabled:opacity-40 ${b.style}`}
              >
                {busy === b.target ? <RefreshCw className="h-4 w-4 animate-spin" /> : b.icon}{b.label}
              </button>
              <p className="text-xs text-gray-400 mt-1 text-center">{b.hint}</p>
            </div>
          ))}
        </div>
        {status && !status.controls.space_restart && (
          <p className="text-xs text-gray-500 mt-3">
            Space restart is unavailable here (needs the <code>HF_TOKEN</code> secret on Hugging Face). You can always
            restart from the Space's Settings page or the GitHub “Space Watchdog” workflow.
          </p>
        )}
      </div>
    </div>
  );
};

export default SystemHealth;
