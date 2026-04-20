/**
 * AttendanceTracker — Real-time attendance list for an active classroom session
 *
 * Features:
 *  - Polls /api/v2/recognition/attendance_status/<section_id> every 3 s
 *  - Confirmed present list with entry-time display
 *  - Vote progress bar per student (votes → confirm threshold visualisation)
 *  - Pending review queue with Approve / Reject teacher actions
 *  - Absent list: section students minus confirmed present
 *  - Export button (calls existing /api/attendance/export)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { recognitionV2API, studentAPI, attendanceAPI, handleApiError } from '../services/api';
import type { Student } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VoteRecord {
  votes:          number;
  confirmed:      boolean;
  avg_similarity: number;
}

interface SectionStatus {
  section_id:     number;
  subject_id:     number;
  present:        number[];
  vote_snapshot:  Record<string, VoteRecord>;
  pending_review: number;
  session_active: boolean;
  uptime_seconds: number;
}

interface ReviewItem {
  id:         string;
  student_id: number;
  name:       string;
  similarity: number;
  timestamp:  string;
  section_id: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIRM_RATIO = 0.70;   // mirrors Python constant
const MIN_VOTES     = 3;

function VoteBar({ votes, total }: { votes: number; total: number }) {
  const pct = total > 0 ? Math.min((votes / total) * 100, 100) : 0;
  const reaching = pct >= CONFIRM_RATIO * 100;
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full transition-all ${reaching ? 'bg-green-500' : 'bg-blue-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function formatUptime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  sectionId: number;
  subjectId: number;
  /** If passed, absent list is derived from this set */
  allStudents?: Student[];
}

const AttendanceTracker: React.FC<Props> = ({ sectionId, subjectId, allStudents }) => {
  const [status, setStatus]       = useState<SectionStatus | null>(null);
  const [reviews, setReviews]     = useState<ReviewItem[]>([]);
  const [students, setStudents]   = useState<Map<number, Student>>(new Map());
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<'present' | 'review' | 'absent'>('present');
  const [exporting, setExporting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch student names once ─────────────────────────────────────────────
  useEffect(() => {
    if (allStudents) {
      setStudents(new Map(allStudents.map(s => [s.id, s])));
      return;
    }
    studentAPI
      .getAll({ limit: 1000 })
      .then(({ students: list }) =>
        setStudents(new Map(list.map(s => [s.id, s])))
      )
      .catch(() => {});
  }, [allStudents]);

  // ── Poll status ──────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const data = await recognitionV2API.getSectionStatus(sectionId);
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    }
  }, [sectionId]);

  const fetchReviews = useCallback(async () => {
    try {
      const { items } = await recognitionV2API.getReviewQueue(sectionId);
      setReviews(items);
    } catch {
      // non-critical
    }
  }, [sectionId]);

  useEffect(() => {
    fetchStatus();
    fetchReviews();
    pollRef.current = setInterval(() => {
      fetchStatus();
      fetchReviews();
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus, fetchReviews]);

  // ── Teacher review actions ───────────────────────────────────────────────
  const handleReview = async (itemId: string, decision: 'approve' | 'reject') => {
    try {
      await recognitionV2API.resolveReview(itemId, sectionId, decision);
      setReviews(prev => prev.filter(r => r.id !== itemId));
      if (decision === 'approve') fetchStatus();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await attendanceAPI.export({ subject_id: subjectId });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `attendance_section${sectionId}_subject${subjectId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setExporting(false);
    }
  };

  // ── Derived: absent students ─────────────────────────────────────────────
  const presentSet  = new Set(status?.present ?? []);
  const absentStudents = allStudents
    ? allStudents.filter(s => !presentSet.has(s.id))
    : [];

  // ── Vote summary stats ───────────────────────────────────────────────────
  const totalVotes = Object.values(status?.vote_snapshot ?? {})
    .reduce((a, v) => a + v.votes, 0);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-800 rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">
              Attendance Tracker
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              {status ? (
                <>
                  {status.session_active ? '🟢 Live' : '🔴 Stopped'} ·{' '}
                  {formatUptime(status.uptime_seconds)} · {status.present.length} present
                </>
              ) : 'Loading…'}
            </p>
          </div>
          <button
            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : '↓ CSV'}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-xs mt-1">{error}</p>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          {[
            { key: 'present', label: `Present (${status?.present.length ?? 0})` },
            { key: 'review',  label: `Review (${reviews.length})` },
            { key: 'absent',  label: `Absent (${absentStudents.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`flex-1 text-xs py-1 rounded-lg transition-colors ${
                tab === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setTab(key as typeof tab)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">

        {/* ── Present tab ── */}
        {tab === 'present' && (
          <>
            {status?.present.length === 0 ? (
              <p className="text-gray-500 text-xs text-center mt-6">
                No students confirmed present yet.
              </p>
            ) : (
              status?.present.map(sid => {
                const student = students.get(sid);
                return (
                  <div
                    key={sid}
                    className="flex items-center gap-2 bg-green-900/30 border border-green-800/50
                               rounded-lg px-3 py-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">
                        {student?.name ?? student?.roll_number ?? `Student ${sid}`}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {student?.roll_number} · Present
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pending votes (not yet confirmed) */}
            {status && Object.entries(status.vote_snapshot)
              .filter(([sid, v]) => !v.confirmed && v.votes >= MIN_VOTES)
              .map(([sid, v]) => {
                const student = students.get(parseInt(sid));
                return (
                  <div
                    key={`vote-${sid}`}
                    className="bg-gray-700/50 border border-gray-700 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-gray-300 text-xs font-medium truncate">
                        {student?.name ?? `Student ${sid}`}
                      </p>
                      <span className="text-gray-500 text-xs">
                        {v.votes}/{totalVotes} votes
                      </span>
                    </div>
                    <VoteBar votes={v.votes} total={totalVotes} />
                    <p className="text-gray-500 text-xs mt-0.5">
                      Avg similarity: {(v.avg_similarity * 100).toFixed(0)}%
                    </p>
                  </div>
                );
              })
            }
          </>
        )}

        {/* ── Review tab ── */}
        {tab === 'review' && (
          <>
            {reviews.length === 0 ? (
              <p className="text-gray-500 text-xs text-center mt-6">
                No pending review items.
              </p>
            ) : (
              reviews.map(item => (
                <div
                  key={item.id}
                  className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-yellow-200 text-xs font-medium">{item.name}</p>
                      <p className="text-gray-400 text-xs">
                        Sim: {(item.similarity * 100).toFixed(0)}% · {formatTime(item.timestamp)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
                        onClick={() => handleReview(item.id, 'approve')}
                      >
                        ✓
                      </button>
                      <button
                        className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                        onClick={() => handleReview(item.id, 'reject')}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs">
                    Student ID: {item.student_id}
                  </p>
                </div>
              ))
            )}
          </>
        )}

        {/* ── Absent tab ── */}
        {tab === 'absent' && (
          <>
            {!allStudents ? (
              <p className="text-gray-500 text-xs text-center mt-6">
                Absent list available when section roster is loaded.
              </p>
            ) : absentStudents.length === 0 ? (
              <p className="text-gray-500 text-xs text-center mt-6">
                All students are present!
              </p>
            ) : (
              absentStudents.map(student => (
                <div
                  key={student.id}
                  className="flex items-center gap-2 bg-red-900/20 border border-red-900/40
                             rounded-lg px-3 py-2"
                >
                  <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-white text-xs font-medium">
                      {student.name ?? student.roll_number}
                    </p>
                    <p className="text-gray-400 text-xs">{student.roll_number}</p>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AttendanceTracker;
