import React, { useState, useEffect } from 'react';
import { X, Save, Loader } from 'lucide-react';
import { attendanceAPI } from '../services/api';
import toast from 'react-hot-toast';
import type { AttendanceLog } from '../types';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance: AttendanceLog | null;
  onUpdate: () => void;
}

const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  attendance,
  onUpdate
}) => {
  const [status, setStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [entryTime, setEntryTime] = useState('');
  const [exitTime, setExitTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (attendance) {
      setStatus(attendance.status as 'present' | 'absent' | 'late');
      setEntryTime(attendance.entry_time || '');
      setExitTime(attendance.exit_time || '');
      setNotes(attendance.notes || '');
    }
  }, [attendance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!attendance) return;

    setLoading(true);

    try {
      const updateData: any = {
        status,
        notes: notes || undefined,
      };

      // Only include times if status is not absent
      if (status !== 'absent') {
        if (entryTime) updateData.entry_time = entryTime;
        if (exitTime) updateData.exit_time = exitTime;
      }

      await attendanceAPI.update(attendance.id, updateData);

      toast.success('Attendance updated successfully!');
      onUpdate(); // Refresh the attendance data
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update attendance';
      toast.error(errorMessage);
      console.error('Error updating attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !attendance) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit Attendance</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900">{attendance.student_name}</h3>
          <div className="text-sm text-gray-500 space-y-1 mt-1">
            <p>Subject: {attendance.subject_name}</p>
            <p>Date: {new Date(attendance.date).toLocaleDateString()}</p>
            <p>Current Status: <span className="capitalize font-medium">{attendance.status}</span></p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'present' | 'absent' | 'late')}
              disabled={loading}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
          </div>

          {status !== 'absent' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entry Time
              </label>
              <input
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
              />
            </div>
          )}

          {status !== 'absent' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exit Time (Optional)
              </label>
              <input
                type="time"
                value={exitTime}
                onChange={(e) => setExitTime(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={loading}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center px-4 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AttendanceModal;
