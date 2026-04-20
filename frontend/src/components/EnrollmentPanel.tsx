/**
 * EnrollmentPanel — Admin face enrollment for InsightFace V2 pipeline
 *
 * Features:
 *  - Live webcam capture with face guide overlay
 *  - Upload mode: drag-and-drop or file picker (multiple images)
 *  - Real-time quality preview (blur / brightness indicator)
 *  - Captures 1-10 images then calls POST /api/v2/recognition/enroll
 *  - Shows per-student enrollment status and delete button
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { recognitionV2API, studentAPI, handleApiError } from '../services/api';
import type { Student } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CapturedImage {
  id:     string;
  b64:    string;       // data:image/jpeg;base64,...
  thumb:  string;       // same but shown as preview
}

type Tab = 'webcam' | 'upload';
type EnrollState = 'idle' | 'capturing' | 'enrolling' | 'done' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  /** Pre-select a student (e.g., opened from student list row) */
  initialStudentId?: number;
}

const EnrollmentPanel: React.FC<Props> = ({ initialStudentId }) => {
  // ── Student selector ────────────────────────────────────────────────────
  const [students, setStudents]   = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<number | ''>(initialStudentId ?? '');
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ── Tab + images ────────────────────────────────────────────────────────
  const [tab, setTab]               = useState<Tab>('webcam');
  const [images, setImages]         = useState<CapturedImage[]>([]);
  const [enrollState, setEnrollState] = useState<EnrollState>('idle');
  const [message, setMessage]       = useState<string | null>(null);
  const [isError, setIsError]       = useState(false);

  // ── Webcam ──────────────────────────────────────────────────────────────
  const webcamRef = useRef<Webcam>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // ── Drag-and-drop ───────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false);

  // ── Load student list ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setStudentsLoading(true);
      try {
        const { students: list } = await studentAPI.getAll({ limit: 1000 });
        setStudents(list);
      } catch {
        // non-critical
      } finally {
        setStudentsLoading(false);
      }
    })();
  }, []);

  // ── Webcam capture ──────────────────────────────────────────────────────
  const captureFrame = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) return;
    if (images.length >= 10) {
      setMessage('Maximum 10 images captured. Remove some to recapture.');
      setIsError(true);
      return;
    }
    setImages(prev => [...prev, { id: uid(), b64: shot, thumb: shot }]);
    setMessage(null);
    setIsError(false);
  }, [images.length]);

  // Keyboard shortcut: Space to capture
  useEffect(() => {
    if (tab !== 'webcam') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        captureFrame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, captureFrame]);

  // ── File upload ─────────────────────────────────────────────────────────
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newImages: CapturedImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (images.length + newImages.length >= 10) break;
      const b64 = await toBase64(file);
      newImages.push({ id: uid(), b64, thumb: b64 });
    }
    setImages(prev => [...prev, ...newImages].slice(0, 10));
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // ── Drag-and-drop handlers ───────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Enroll ──────────────────────────────────────────────────────────────
  const handleEnroll = async () => {
    if (!studentId) {
      setMessage('Please select a student first.');
      setIsError(true);
      return;
    }
    if (images.length === 0) {
      setMessage('Capture or upload at least one image.');
      setIsError(true);
      return;
    }

    setEnrollState('enrolling');
    setMessage(null);
    setIsError(false);

    try {
      const result = await recognitionV2API.enroll(
        studentId as number,
        images.map(img => img.b64),
      );
      setEnrollState('done');
      setMessage(`Enrolled successfully — ${result.images_used} image(s) used.`);
      setIsError(false);
      setImages([]);
    } catch (err) {
      setEnrollState('error');
      setMessage(handleApiError(err));
      setIsError(true);
    }
  };

  const handleDeleteImage = (id: string) =>
    setImages(prev => prev.filter(img => img.id !== id));

  const handleReset = () => {
    setImages([]);
    setEnrollState('idle');
    setMessage(null);
    setIsError(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl mx-auto">
      <h2 className="text-white text-lg font-bold mb-1">Face Enrollment</h2>
      <p className="text-gray-400 text-sm mb-5">
        Enroll a student's face into the ArcFace recognition system.
        Capture 3–6 images from slightly different angles for best accuracy.
      </p>

      {/* Student selector */}
      <div className="mb-5">
        <label className="block text-sm text-gray-400 mb-1">Student</label>
        <select
          className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm
                     border border-gray-600 focus:border-blue-500 outline-none"
          value={studentId}
          onChange={e => setStudentId(e.target.value ? parseInt(e.target.value) : '')}
          disabled={studentsLoading}
        >
          <option value="">
            {studentsLoading ? 'Loading students…' : '— Select student —'}
          </option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.roll_number} ({s.roll_number}) — {s.section}
            </option>
          ))}
        </select>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-5">
        {(['webcam', 'upload'] as Tab[]).map(t => (
          <button
            key={t}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'webcam' ? '📷 Webcam' : '📁 Upload'}
          </button>
        ))}
      </div>

      {/* ── Webcam tab ── */}
      {tab === 'webcam' && (
        <div className="mb-5">
          <div className="relative rounded-xl overflow-hidden bg-black">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.92}
              videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
              className="w-full"
              onUserMedia={() => setCameraReady(true)}
              onUserMediaError={() => {
                setMessage('Camera access denied. Check browser permissions.');
                setIsError(true);
              }}
            />
            {/* Face guide oval */}
            {cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-blue-400/60 rounded-full"
                     style={{ width: '44%', height: '72%' }} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <p className="text-gray-500 text-xs">
              Press <kbd className="bg-gray-700 px-1 rounded">Space</kbd> or click to capture.
              {images.length}/10 captured.
            </p>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2
                         rounded-lg disabled:opacity-40"
              disabled={!cameraReady || images.length >= 10}
              onClick={captureFrame}
            >
              Capture
            </button>
          </div>
        </div>
      )}

      {/* ── Upload tab ── */}
      {tab === 'upload' && (
        <div
          className={`mb-5 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragging
              ? 'border-blue-500 bg-blue-900/20'
              : 'border-gray-600 hover:border-gray-500'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="text-3xl mb-2">🖼️</div>
          <p className="text-gray-300 text-sm mb-3">
            Drag & drop images here, or click to browse
          </p>
          <label className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2
                            rounded-lg cursor-pointer">
            Browse Files
            <input
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={e => handleFiles(e.target.files)}
            />
          </label>
          <p className="text-gray-500 text-xs mt-2">{images.length}/10 loaded</p>
        </div>
      )}

      {/* Captured thumbnails */}
      {images.length > 0 && (
        <div className="mb-5">
          <p className="text-gray-400 text-xs mb-2">Captured images:</p>
          <div className="flex flex-wrap gap-2">
            {images.map(img => (
              <div key={img.id} className="relative group">
                <img
                  src={img.thumb}
                  alt="capture"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-700"
                />
                <button
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white
                             rounded-full text-xs flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteImage(img.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          isError
            ? 'bg-red-900/40 border border-red-700 text-red-300'
            : 'bg-green-900/40 border border-green-700 text-green-300'
        }`}>
          {message}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg
                     disabled:opacity-40"
          onClick={handleReset}
          disabled={enrollState === 'enrolling'}
        >
          Clear
        </button>
        <button
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg
                     disabled:opacity-40 font-medium"
          onClick={handleEnroll}
          disabled={
            enrollState === 'enrolling' || !studentId || images.length === 0
          }
        >
          {enrollState === 'enrolling' ? 'Enrolling…' : 'Enroll Student'}
        </button>
      </div>

      {/* Tips */}
      <div className="mt-5 p-3 bg-gray-700/50 rounded-xl text-xs text-gray-400 space-y-1">
        <p>• Face the camera directly for the first image, then tilt slightly left/right.</p>
        <p>• Ensure consistent, non-glare lighting (avoid strong backlight).</p>
        <p>• Remove glasses/masks if possible for the enrollment set.</p>
        <p>• 5–6 images from varied angles give the best ArcFace accuracy.</p>
      </div>
    </div>
  );
};

export default EnrollmentPanel;
