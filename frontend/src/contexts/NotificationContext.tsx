import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import type { Notification } from '../types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  // Actions
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendNotification: (studentId: number, message: string, type: string, title?: string) => Promise<void>;
  sendBulkNotification: (studentIds: number[], message: string, type: string, title?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user, isStudent } = useAuth();
  const { onNotificationSent } = useSocket();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch notifications for current student
   */
  const fetchNotifications = useCallback(async () => {
    if (!user || !isStudent) return;

    try {
      setLoading(true);
      setError(null);

      const response = await notificationAPI.getForStudent(user.id);
      setNotifications(response.notifications);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch notifications';
      setError(errorMessage);
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isStudent]);

  /**
   * Fetch unread notification count
   */
  const fetchUnreadCount = useCallback(async () => {
    if (!user || !isStudent) return;

    try {
      const response = await notificationAPI.getUnreadCount(user.id);
      setUnreadCount(response.unread_count);
    } catch (err: any) {
      console.error('Fetch unread count error:', err);
    }
  }, [user, isStudent]);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      await notificationAPI.markAsRead(notificationId);

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif =>
          notif.id === notificationId ? { ...notif, read_status: true } : notif
        )
      );

      // Decrement unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to mark as read';
      console.error('Mark as read error:', err);
      toast.error(errorMessage);
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      // Mark each unread notification as read
      const unreadNotifications = notifications.filter(n => !n.read_status);

      await Promise.all(
        unreadNotifications.map(notif => notificationAPI.markAsRead(notif.id))
      );

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif => ({ ...notif, read_status: true }))
      );

      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to mark all as read';
      console.error('Mark all as read error:', err);
      toast.error(errorMessage);
    }
  }, [notifications]);

  /**
   * Send notification to a student
   */
  const sendNotification = useCallback(async (
    studentId: number,
    message: string,
    type: string,
    title?: string
  ) => {
    try {
      await notificationAPI.send({
        student_id: studentId,
        message,
        type,
        title,
      });

      toast.success('Notification sent successfully');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send notification';
      console.error('Send notification error:', err);
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Send bulk notifications to multiple students
   */
  const sendBulkNotification = useCallback(async (
    studentIds: number[],
    message: string,
    type: string,
    title?: string
  ) => {
    try {
      const response = await notificationAPI.sendBulk({
        student_ids: studentIds,
        message,
        type,
        title,
      });

      toast.success(`Notification sent to ${response.sent_count} students`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send notifications';
      console.error('Send bulk notification error:', err);
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Listen for real-time notification events
   */
  useEffect(() => {
    if (!user || !isStudent) return;

    const cleanup = onNotificationSent((data) => {
      // Only handle notifications for current user
      if (data.student_id !== user.id) return;

      // Add new notification to list
      const newNotification: Notification = {
        id: data.notification_id,
        student_id: data.student_id,
        message: data.message,
        type: data.type as any,
        title: undefined,
        read_status: false,
        created_at: new Date().toISOString(),
      };

      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show toast notification
      const toastMessage = data.message;
      switch (data.type) {
        case 'alert':
          toast.error(toastMessage, { duration: 5000 });
          break;
        case 'warning':
          toast(toastMessage, {
            icon: '⚠️',
            duration: 5000
          });
          break;
        case 'info':
        case 'announcement':
        default:
          toast(toastMessage, {
            icon: '🔔',
            duration: 4000
          });
          break;
      }
    });

    return cleanup;
  }, [user, isStudent, onNotificationSent]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    if (user && isStudent) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [user, isStudent, fetchNotifications, fetchUnreadCount]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    sendNotification,
    sendBulkNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

/**
 * Hook to use notification context
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
