import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { authAPI, setAuthToken, getAuthToken, clearAuth, setCurrentUser, getCurrentUser } from '../services/api';
import type { User, LoginCredentials } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithFace: (imageData: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = getAuthToken();
        const storedUser = getCurrentUser();

        if (storedToken && storedUser) {
          // Verify token is still valid
          const result = await authAPI.verifyToken();
          if (result.valid && result.user) {
            setToken(storedToken);
            setUser(result.user);
          } else {
            // Token invalid, clear auth
            clearAuth();
          }
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login with username and password
   */
  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authAPI.login(credentials);

      // Store token and user
      setAuthToken(response.token);
      setCurrentUser(response.user);

      setToken(response.token);
      setUser(response.user);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Login with face recognition
   */
  const loginWithFace = async (imageData: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authAPI.loginWithFace(imageData);

      // Store token and user
      setAuthToken(response.token);
      setCurrentUser(response.user);

      setToken(response.token);
      setUser(response.user);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Face login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      setLoading(true);
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear state regardless of API call success
      clearAuth();
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  /**
   * Refresh user data from server
   */
  const refreshUser = async () => {
    try {
      const result = await authAPI.verifyToken();
      if (result.valid && result.user) {
        setCurrentUser(result.user);
        setUser(result.user);
      } else {
        throw new Error('Invalid token');
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
      // If refresh fails, logout
      await logout();
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    error,
    login,
    loginWithFace,
    logout,
    refreshUser,
    isAuthenticated: !!user && !!token,
    isTeacher: user?.role === 'teacher',
    isStudent: user?.role === 'student',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * HOC to protect routes that require authentication
 */
export const withAuth = <P extends object>(Component: React.ComponentType<P>) => {
  return (props: P) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/';
      return null;
    }

    return <Component {...props} />;
  };
};

/**
 * HOC to protect routes that require teacher role
 */
export const withTeacherAuth = <P extends object>(Component: React.ComponentType<P>) => {
  return (props: P) => {
    const { isAuthenticated, isTeacher, loading } = useAuth();

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/';
      return null;
    }

    if (!isTeacher) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
            <p className="text-gray-600">This page is only accessible to teachers.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

/**
 * HOC to protect routes that require student role
 */
export const withStudentAuth = <P extends object>(Component: React.ComponentType<P>) => {
  return (props: P) => {
    const { isAuthenticated, isStudent, loading } = useAuth();

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    if (!isStudent) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
            <p className="text-gray-600">This page is only accessible to students.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};
