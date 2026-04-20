/**
 * Centralised API configuration.
 * Set VITE_API_URL in .env for production (e.g. https://your-hf-space.hf.space/api).
 */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/** WebSocket / Socket.IO server root (strip the /api suffix). */
export const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');
