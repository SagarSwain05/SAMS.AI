/**
 * LandingPage — SAMS.AI public marketing page
 * Student Attendance Management System
 * Roboto font · RWD · Professional UI/UX
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Users, BarChart3, Clock, Shield, Zap, CheckCircle,
  BookOpen, MonitorPlay, Brain, ArrowRight, LogIn, X,
  GraduationCap, ChevronRight, Activity, Lock, LayoutDashboard,
  Building2, Send, MapPin, Phone, Mail,
} from 'lucide-react';
import LoginPage from './LoginPage';
import { useAuth } from '../contexts/AuthContext';

/* ── Font style injected once ──────────────────────────────────────────────── */
const FONT_STYLE = `
  *, *::before, *::after { font-family: 'Roboto', system-ui, sans-serif; }
  .font-mono { font-family: 'Roboto Mono', monospace; }
`;

/* ── Scroll progress hook ───────────────────────────────────────────────────── */
function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
/* ── Institute Interest Modal ───────────────────────────────────────────────── */
const InstituteModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [form, setForm] = useState({
    institute_name: '', city: '', state: '', contact_person: '',
    email: '', phone: '', student_count: '', message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production this would POST to a registration API
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 rounded-t-2xl flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Implement in Your Institute</h3>
              <p className="text-indigo-200 text-xs mt-0.5">Register interest · We'll set everything up</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors mt-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="text-xl font-bold text-gray-900">Request Submitted!</h4>
            <p className="text-gray-500 text-sm leading-relaxed">
              Thank you for your interest in SAMS.AI. Our team will contact you within 24–48 hours
              to discuss implementation plans tailored to your institution.
            </p>
            <button onClick={onClose}
              className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
              <strong>Currently deployed at:</strong> Trident Academy of Technology, Bhubaneswar
              — 675 students · 35 teachers · 15 sections · 7 branches
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Institute Name *</label>
                <input required type="text" placeholder="e.g. ABC Engineering College"
                  value={form.institute_name} onChange={e => setForm({...form, institute_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">City *</label>
                <input required type="text" placeholder="City"
                  value={form.city} onChange={e => setForm({...form, city: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">State *</label>
                <input required type="text" placeholder="State"
                  value={form.state} onChange={e => setForm({...form, state: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Person *</label>
                <input required type="text" placeholder="Name"
                  value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Approx. Students</label>
                <input type="number" placeholder="e.g. 1200"
                  value={form.student_count} onChange={e => setForm({...form, student_count: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input required type="email" placeholder="admin@institute.edu"
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                <input type="tel" placeholder="+91 XXXXXXXXXX"
                  value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Requirements</label>
                <textarea rows={3} placeholder="Any specific requirements or questions…"
                  value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
              </div>
            </div>

            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-violet-600
                         text-white font-bold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all text-sm">
              <Send className="h-4 w-4" /> Submit Request
            </button>

            <p className="text-xs text-center text-gray-400">
              Our team will reach out within 24–48 hours to discuss your implementation plan.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showInstituteModal, setShowInstituteModal] = useState(false);
  const scrolled = useScrolled();

  // If user logs in via LoginPage, redirect immediately to dashboard
  useEffect(() => {
    if (user) {
      const dest = user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/student';
      navigate(dest, { replace: true });
    }
  }, [user, navigate]);

  const handleGetStarted = () => {
    if (user) {
      const dest = user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/student';
      navigate(dest, { replace: true });
    } else {
      setShowLogin(true);
    }
  };

  if (showLogin) {
    return (
      <div className="relative">
        <style>{FONT_STYLE}</style>
        <LoginPage />
        <button
          onClick={() => setShowLogin(false)}
          className="fixed top-4 left-4 z-50 flex items-center gap-2 bg-white/95 backdrop-blur-sm
                     border border-gray-200 rounded-full px-4 py-2 text-sm font-medium text-gray-700
                     shadow-lg hover:bg-gray-50 transition-all"
        >
          <X className="h-4 w-4" /> Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-gray-100'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl
                              bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div className="leading-none">
                <div className="text-base font-black text-gray-900 tracking-tight">SAMS<span className="text-indigo-600">.AI</span></div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Attendance System</div>
              </div>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {['Features', 'How It Works', 'Stats'].map(link => (
                <a
                  key={link}
                  href={`#${link.toLowerCase().replace(/\s/g, '')}`}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                >
                  {link}
                </a>
              ))}
              <button
                onClick={() => setShowInstituteModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-violet-700
                           bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-all"
              >
                <Building2 className="h-4 w-4" /> Implement in Your Institute
              </button>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              {user ? (
                <button
                  onClick={handleGetStarted}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold
                             bg-indigo-600 text-white rounded-lg hover:bg-indigo-700
                             transition-all shadow-sm shadow-indigo-200"
                >
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={handleGetStarted}
                    className="hidden sm:flex items-center gap-2 px-5 py-2 text-sm font-semibold
                               text-indigo-600 border-2 border-indigo-200 rounded-lg
                               hover:bg-indigo-50 hover:border-indigo-400 transition-all"
                  >
                    <LogIn className="h-4 w-4" /> Login
                  </button>
                  <button
                    onClick={handleGetStarted}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold
                               bg-indigo-600 text-white rounded-lg hover:bg-indigo-700
                               transition-all shadow-sm shadow-indigo-200"
                  >
                    Get Started <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        {/* Subtle background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)]
                        bg-[size:48px_48px] opacity-30 pointer-events-none" />
        {/* Gradient orbs */}
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-violet-100 rounded-full blur-3xl opacity-40 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200
                            rounded-full text-xs font-semibold text-indigo-700 mb-8 uppercase tracking-widest">
              <Zap className="h-3.5 w-3.5" />
              AI-Powered · Real-Time · Timetable-Driven
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight mb-6">
              Attendance,{' '}
              <span className="relative inline-block">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                  Reimagined
                </span>
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full opacity-40" />
              </span>
              <br />
              for Modern Colleges
            </h1>

            {/* Sub */}
            <p className="text-lg text-gray-500 font-normal max-w-2xl mx-auto mb-10 leading-relaxed">
              Face recognition marks attendance for every student — synced with the live timetable.
              No registers. No roll calls. Students just walk in.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
              <button
                onClick={handleGetStarted}
                className="flex items-center gap-2.5 px-8 py-3.5 bg-indigo-600 text-white
                           rounded-xl text-base font-bold hover:bg-indigo-700 transition-all
                           shadow-lg shadow-indigo-200 w-full sm:w-auto justify-center"
              >
                Get Started Free <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#howitworks"
                className="flex items-center gap-2 px-8 py-3.5 border border-gray-200 text-gray-700
                           rounded-xl text-base font-semibold hover:border-indigo-300 hover:text-indigo-600
                           bg-white transition-all w-full sm:w-auto justify-center"
              >
                How It Works
              </a>
            </div>

            {/* Currently deployed banner */}
            <div className="inline-flex items-center gap-3 px-5 py-3 bg-white border border-indigo-100 rounded-2xl shadow-sm shadow-indigo-100 mb-6">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live at</span>
              </div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-bold text-gray-900">Trident Academy of Technology</span>
                <span className="text-xs text-gray-400">Bhubaneswar, Odisha</span>
              </div>
              <button
                onClick={() => setShowInstituteModal(true)}
                className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5" /> For your institute →
              </button>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 font-medium">
              {['675 Students Enrolled', '99%+ Recognition Accuracy', 'Real-Time Sync', 'Zero Paper'].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-100 to-violet-100 rounded-3xl blur-2xl opacity-60" />
              <div className="relative bg-gray-950 rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                {/* Window bar */}
                <div className="flex items-center gap-2 px-5 py-3.5 bg-gray-900 border-b border-gray-800">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="flex items-center gap-2 bg-gray-800 rounded-md px-4 py-1 text-xs text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      SAMS.AI — Live Dashboard
                    </div>
                  </div>
                </div>

                {/* Dashboard content */}
                <div className="p-5 space-y-4">
                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Present Today', value: '487', color: 'text-green-400', border: 'border-green-800/40', bg: 'bg-green-900/20' },
                      { label: 'Absent', value: '188', color: 'text-red-400', border: 'border-red-800/40', bg: 'bg-red-900/20' },
                      { label: 'Attendance Rate', value: '72%', color: 'text-indigo-400', border: 'border-indigo-800/40', bg: 'bg-indigo-900/20' },
                    ].map(c => (
                      <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-4`}>
                        <p className={`${c.color} text-2xl font-black tracking-tight`}>{c.value}</p>
                        <p className="text-gray-500 text-xs mt-1 font-medium">{c.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recognition event */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
                      <Camera className="h-4 w-4 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-green-400 text-sm font-semibold">Face Recognized</p>
                      <p className="text-gray-500 text-xs truncate">Rahul Sharma — CSE-A · Mathematics marked Present</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 rounded-full px-3 py-1 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-400 text-xs font-bold tracking-wide">LIVE</span>
                    </div>
                  </div>

                  {/* Mini attendance rows */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-4 px-4 py-2 border-b border-gray-800">
                      {['Student', 'Section', 'Subject', 'Status'].map(h => (
                        <p key={h} className="text-gray-600 text-[10px] font-semibold uppercase tracking-wider">{h}</p>
                      ))}
                    </div>
                    {[
                      { name: 'Priya Verma', section: 'CSE-B', subject: 'DBMS', status: 'Present', ok: true },
                      { name: 'Amit Singh', section: 'ETC-A', subject: 'Signals', status: 'Late', ok: false },
                      { name: 'Sneha Roy', section: 'CSAIML-A', subject: 'ML Lab', status: 'Present', ok: true },
                    ].map(row => (
                      <div key={row.name} className="grid grid-cols-4 px-4 py-2.5 border-b border-gray-800/50 last:border-0">
                        <p className="text-gray-300 text-xs font-medium truncate">{row.name}</p>
                        <p className="text-gray-500 text-xs">{row.section}</p>
                        <p className="text-gray-500 text-xs truncate">{row.subject}</p>
                        <span className={`text-xs font-semibold ${row.ok ? 'text-green-400' : 'text-yellow-400'}`}>
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────── */}
      <section id="stats" className="py-14 bg-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center text-white">
            {[
              { value: '675', label: 'Students Enrolled', icon: <GraduationCap className="h-5 w-5" /> },
              { value: '15',  label: 'Active Sections',   icon: <BookOpen className="h-5 w-5" /> },
              { value: '7',   label: 'Branches',          icon: <Users className="h-5 w-5" /> },
              { value: '35',  label: 'Faculty Members',   icon: <Shield className="h-5 w-5" /> },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center">
                <div className="mb-2 text-indigo-300 opacity-80">{s.icon}</div>
                <p className="text-4xl sm:text-5xl font-black tracking-tight">{s.value}</p>
                <p className="text-indigo-200 mt-1.5 text-sm font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-4">
              Everything You Need
            </h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
              A complete attendance ecosystem — from camera to report — built for modern colleges.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Brain className="h-6 w-6" />,
                gradient: 'from-indigo-500 to-blue-500',
                bg: 'bg-indigo-50',
                title: 'AI Face Recognition',
                desc: 'InsightFace ArcFace R100 (512-dim embeddings) with anti-spoofing. Identifies faces in real-time with 99%+ accuracy.',
              },
              {
                icon: <Clock className="h-6 w-6" />,
                gradient: 'from-violet-500 to-purple-500',
                bg: 'bg-violet-50',
                title: 'Timetable-Driven',
                desc: 'Auto-resolves the current subject per student from the live timetable — no manual subject selection required.',
              },
              {
                icon: <MonitorPlay className="h-6 w-6" />,
                gradient: 'from-emerald-500 to-teal-500',
                bg: 'bg-emerald-50',
                title: 'Campus Kiosk',
                desc: 'Public attendance terminal at entrance. Students walk in, face is detected, attendance is logged instantly.',
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                gradient: 'from-orange-500 to-rose-500',
                bg: 'bg-orange-50',
                title: 'Deep Analytics',
                desc: 'Branch-wise, section-wise, subject-wise analytics. Identify at-risk students. Download CSV reports in one click.',
              },
              {
                icon: <Users className="h-6 w-6" />,
                gradient: 'from-cyan-500 to-sky-500',
                bg: 'bg-cyan-50',
                title: 'Multi-Role Access',
                desc: 'Admin, Teacher, and Student dashboards each tailored to their responsibilities with role-based security.',
              },
              {
                icon: <Lock className="h-6 w-6" />,
                gradient: 'from-slate-600 to-gray-700',
                bg: 'bg-slate-50',
                title: 'Secure by Design',
                desc: 'JWT authentication, bcrypt password hashing, anti-spoofing detection, and RBAC on every endpoint.',
              },
            ].map(f => (
              <div
                key={f.title}
                className="group bg-white border border-gray-100 rounded-2xl p-6
                           hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300"
              >
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${f.gradient} text-white mb-4 shadow-sm`}>
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="howitworks" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-4">
              Three Steps. Zero Effort.
            </h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto">From student walking in to attendance record — fully automated.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
            {[
              {
                step: '01',
                icon: <Camera className="h-7 w-7" />,
                title: 'Student Walks In',
                desc: 'Student passes the kiosk or classroom camera. No badge, no card, no phone needed. Just their face.',
                color: 'from-indigo-500 to-blue-500',
              },
              {
                step: '02',
                icon: <Brain className="h-7 w-7" />,
                title: 'Face Recognized',
                desc: 'AI detects and identifies the student in under 100ms with anti-spoofing to prevent photo fraud.',
                color: 'from-violet-500 to-indigo-500',
              },
              {
                step: '03',
                icon: <Activity className="h-7 w-7" />,
                title: 'Attendance Logged',
                desc: "System resolves the student's current subject from the live timetable and marks attendance instantly.",
                color: 'from-emerald-500 to-teal-500',
              },
            ].map((s, i) => (
              <div key={s.step} className="relative">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+52px)] w-[calc(100%-104px+2.5rem)] h-px bg-gradient-to-r from-gray-200 to-gray-200 z-0" />
                )}
                <div className="relative bg-white border border-gray-100 rounded-2xl p-6 text-center
                                hover:border-indigo-200 hover:shadow-md transition-all duration-300">
                  {/* Step number badge */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white
                                  text-xs font-black px-3 py-0.5 rounded-full tracking-wider">
                    {s.step}
                  </div>
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl
                                   bg-gradient-to-br ${s.color} text-white shadow-md mb-5 mt-3`}>
                    {s.icon}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLE CARDS ───────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Roles</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-4">
              Built for Everyone
            </h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto">
              Tailored dashboards and controls for every role in your institution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                role: 'Admin',
                label: 'Full Control',
                icon: <Shield className="h-6 w-6" />,
                gradient: 'from-indigo-600 to-violet-600',
                badge: 'bg-indigo-100 text-indigo-700',
                features: [
                  'Live campus camera feed',
                  'All-section attendance grid',
                  'Branch & student analytics',
                  'Timetable management',
                  'User & enrollment management',
                  'Downloadable reports',
                ],
              },
              {
                role: 'Teacher',
                label: 'Class Management',
                icon: <BookOpen className="h-6 w-6" />,
                gradient: 'from-emerald-600 to-teal-600',
                badge: 'bg-emerald-100 text-emerald-700',
                features: [
                  'Section attendance overview',
                  'Mark & edit attendance',
                  'Course-wise analytics',
                  'Student engagement tracking',
                  'At-risk student alerts',
                  'Export class reports',
                ],
              },
              {
                role: 'Student',
                label: 'Personal Tracker',
                icon: <GraduationCap className="h-6 w-6" />,
                gradient: 'from-orange-500 to-rose-500',
                badge: 'bg-orange-100 text-orange-700',
                features: [
                  'Personal attendance stats',
                  'Subject-wise breakdown',
                  'Attendance percentage',
                  'Present / absent history',
                  'At-risk subject alerts',
                  'Real-time notifications',
                ],
              },
            ].map(r => (
              <div
                key={r.role}
                className="flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden
                           hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300"
              >
                {/* Card header */}
                <div className={`bg-gradient-to-br ${r.gradient} px-6 py-5 text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        {r.icon}
                      </div>
                      <div>
                        <p className="text-lg font-black leading-tight">{r.role}</p>
                        <p className="text-xs font-medium text-white/70">{r.label}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${r.badge} px-2.5 py-1 rounded-full`}>
                      Dashboard
                    </span>
                  </div>
                </div>

                {/* Features list */}
                <ul className="flex-1 px-6 py-5 space-y-2.5">
                  {r.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="px-6 pb-6">
                  <button
                    onClick={handleGetStarted}
                    className="w-full py-2.5 text-sm font-bold text-white bg-gray-900
                               rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    Login as {r.role} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                          bg-gradient-to-br from-indigo-500 to-violet-600 mb-6 shadow-xl shadow-indigo-900/50">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Ready to Transform Attendance?
          </h2>
          <p className="text-base text-gray-400 mb-10 leading-relaxed">
            Currently deployed at <span className="text-white font-semibold">Trident Academy of Technology</span>.
            Bring the same AI-powered system to your institution.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-3 px-10 py-4 bg-indigo-600 text-white
                         rounded-xl text-base font-bold hover:bg-indigo-500 transition-all
                         shadow-xl shadow-indigo-900/50"
            >
              <LogIn className="h-5 w-5" /> Sign In (Trident)
            </button>
            <button
              onClick={() => setShowInstituteModal(true)}
              className="inline-flex items-center gap-3 px-10 py-4 border-2 border-violet-500 text-violet-300
                         rounded-xl text-base font-bold hover:bg-violet-900/30 transition-all"
            >
              <Building2 className="h-5 w-5" /> Implement in Your Institute
            </button>
          </div>
        </div>
      </section>

      {/* Institute modal */}
      {showInstituteModal && <InstituteModal onClose={() => setShowInstituteModal(false)} />}

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 border-t border-gray-800 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-black">SAMS<span className="text-indigo-400">.AI</span></p>
                <p className="text-gray-600 text-xs">Student Attendance Management System</p>
              </div>
            </div>

            {/* Tech stack */}
            <p className="text-gray-600 text-xs text-center">
              ArcFace R100 · InsightFace · PostgreSQL · Flask · React 18 · TypeScript
            </p>

            {/* Copyright */}
            <p className="text-gray-600 text-xs">
              © {new Date().getFullYear()} SAMS.AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
