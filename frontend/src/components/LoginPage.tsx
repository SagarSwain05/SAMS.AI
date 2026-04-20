import React, { useState } from 'react';
import { User, Eye, EyeOff, Camera, GraduationCap, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const COLLEGE = 'Trident Academy of Technology';
const COLLEGE_SHORT = 'TAT';

const LoginPage: React.FC = () => {
  const { login, loading } = useAuth();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(credentials);
      toast.success('Login successful!');
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative max-w-md w-full">

        {/* College Identity */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20
                          bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-2xl shadow-indigo-900/50 mb-4">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{COLLEGE}</h1>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <MapPin className="h-3.5 w-3.5 text-indigo-400" />
            <p className="text-sm text-indigo-300">Bhubaneswar, Odisha</p>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/10 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-xs font-semibold text-green-300">AI Attendance Portal · Live</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Sign In</h2>
            <p className="text-sm text-indigo-300 mt-0.5">Access your {COLLEGE_SHORT} portal</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-2">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-indigo-400" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-xl
                             text-white placeholder-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400
                             focus:border-transparent transition-all"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="block w-full pl-3 pr-10 py-3 bg-white/10 border border-white/20 rounded-xl
                             text-white placeholder-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400
                             focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword
                    ? <EyeOff className="h-5 w-5 text-indigo-400 hover:text-indigo-200" />
                    : <Eye className="h-5 w-5 text-indigo-400 hover:text-indigo-200" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-500/40 rounded-xl p-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white
                         bg-gradient-to-r from-indigo-600 to-violet-600
                         hover:from-indigo-500 hover:to-violet-500
                         focus:outline-none focus:ring-2 focus:ring-indigo-400
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-900/50"
            >
              {loading
                ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                : 'Sign In to Portal'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-indigo-400">
            Powered by <span className="font-bold text-indigo-300">SAMS.AI</span>
            {' '}· AI-Powered Attendance Management System
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
