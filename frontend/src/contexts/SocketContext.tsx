import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../services/api';
import type { AttendanceLog, RecognitionResult } from '../types';
import { SOCKET_URL } from '../config';

// WebSocket event types
interface AttendanceMarkedEvent {
  subject_id: number;
  count: number;
  students: Array<{
    student_id: number;
    name: string;
    confidence: number;
  }>;
}

interface NotificationSentEvent {
  notification_id: number;
  student_id: number;
  message: string;
  type: string;
}

interface RecognitionStatusEvent {
  status: 'active' | 'inactive';
  subject_id?: number;
  current_detections?: RecognitionResult[];
}

interface AttendanceUpdatedEvent {
  attendance: AttendanceLog;
}

type EventCallback<T = any> = (data: T) => void;

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  // Event listeners
  onAttendanceMarked: (callback: EventCallback<AttendanceMarkedEvent>) => void;
  onNotificationSent: (callback: EventCallback<NotificationSentEvent>) => void;
  onRecognitionStatus: (callback: EventCallback<RecognitionStatusEvent>) => void;
  onAttendanceUpdated: (callback: EventCallback<AttendanceUpdatedEvent>) => void;
  // Room management
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  // Connection management
  connect: () => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize socket connection
   */
  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      console.log('No auth token, skipping socket connection');
      return;
    }

    console.log('Initializing Socket.IO connection to:', SOCKET_URL);

    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket.IO connected:', newSocket.id);
      setConnected(true);
      setReconnecting(false);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      setConnected(false);

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect manually
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
      setError(err.message);
      setConnected(false);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket.IO reconnection attempt:', attemptNumber);
      setReconnecting(true);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
      setReconnecting(false);
      setConnected(true);
      setError(null);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed');
      setReconnecting(false);
      setError('Failed to reconnect to server');
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up Socket.IO connection');
      newSocket.close();
    };
  }, []);

  /**
   * Register callback for attendance_marked events
   */
  const onAttendanceMarked = useCallback((callback: EventCallback<AttendanceMarkedEvent>) => {
    if (!socket) return;

    const handler = (data: AttendanceMarkedEvent) => {
      console.log('Attendance marked event:', data);
      callback(data);
    };

    socket.on('attendance_marked', handler);

    // Return cleanup function
    return () => {
      socket.off('attendance_marked', handler);
    };
  }, [socket]);

  /**
   * Register callback for notification_sent events
   */
  const onNotificationSent = useCallback((callback: EventCallback<NotificationSentEvent>) => {
    if (!socket) return;

    const handler = (data: NotificationSentEvent) => {
      console.log('Notification sent event:', data);
      callback(data);
    };

    socket.on('notification_sent', handler);

    return () => {
      socket.off('notification_sent', handler);
    };
  }, [socket]);

  /**
   * Register callback for recognition_status events
   */
  const onRecognitionStatus = useCallback((callback: EventCallback<RecognitionStatusEvent>) => {
    if (!socket) return;

    const handler = (data: RecognitionStatusEvent) => {
      console.log('Recognition status event:', data);
      callback(data);
    };

    socket.on('recognition_status', handler);

    return () => {
      socket.off('recognition_status', handler);
    };
  }, [socket]);

  /**
   * Register callback for attendance_updated events
   */
  const onAttendanceUpdated = useCallback((callback: EventCallback<AttendanceUpdatedEvent>) => {
    if (!socket) return;

    const handler = (data: AttendanceUpdatedEvent) => {
      console.log('Attendance updated event:', data);
      callback(data);
    };

    socket.on('attendance_updated', handler);

    return () => {
      socket.off('attendance_updated', handler);
    };
  }, [socket]);

  /**
   * Join a room for targeted events
   */
  const joinRoom = useCallback((room: string) => {
    if (!socket) {
      console.warn('Cannot join room - socket not connected');
      return;
    }

    console.log('Joining room:', room);
    socket.emit('join', { room });
  }, [socket]);

  /**
   * Leave a room
   */
  const leaveRoom = useCallback((room: string) => {
    if (!socket) {
      console.warn('Cannot leave room - socket not connected');
      return;
    }

    console.log('Leaving room:', room);
    socket.emit('leave', { room });
  }, [socket]);

  /**
   * Manually connect socket
   */
  const connect = useCallback(() => {
    if (socket && !socket.connected) {
      console.log('Manually connecting socket');
      socket.connect();
    }
  }, [socket]);

  /**
   * Manually disconnect socket
   */
  const disconnect = useCallback(() => {
    if (socket && socket.connected) {
      console.log('Manually disconnecting socket');
      socket.disconnect();
    }
  }, [socket]);

  const value: SocketContextType = {
    socket,
    connected,
    reconnecting,
    error,
    onAttendanceMarked,
    onNotificationSent,
    onRecognitionStatus,
    onAttendanceUpdated,
    joinRoom,
    leaveRoom,
    connect,
    disconnect,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

/**
 * Hook to use socket context
 */
export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
