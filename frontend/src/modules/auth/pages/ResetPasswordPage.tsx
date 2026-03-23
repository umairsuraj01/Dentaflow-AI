// ResetPasswordPage.tsx — Set a new password (split-screen layout matching Login).

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, CheckCircle, AlertTriangle, Brain, Shield, Eye, EyeOff } from 'lucide-react';
import { APP_NAME, ROUTES } from '@/constants';
import { authService } from '../services/auth.service';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate(ROUTES.LOGIN, { replace: true }), 2500);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const validate = (): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Must contain an uppercase letter';
    if (!/[0-9]/.test(password)) return 'Must contain a number';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Must contain a special character';
    if (password !== confirm) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(token!, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.detail || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  /* ================================================================ */
  /*  Left panel (shared across all auth pages)                        */
  /* ================================================================ */
  const LeftPanel = () => (
    <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ y: [-30, 30, -30], x: [-15, 15, -15], scale: [1, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] left-[15%] h-[420px] w-[420px] rounded-full bg-[#3B82F6]/[0.12] blur-[120px]"
        />
        <motion.div
          animate={{ y: [25, -25, 25], x: [12, -12, 12], scale: [1.05, 0.95, 1.05] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[15%] right-[10%] h-[360px] w-[360px] rounded-full bg-[#06B6D4]/[0.10] blur-[120px]"
        />
        <motion.div
          animate={{ y: [18, -18, 18] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[55%] left-[45%] h-[280px] w-[280px] rounded-full bg-[#8B5CF6]/[0.08] blur-[100px]"
        />
      </div>
      {[
        { top: '12%', left: '72%', delay: 0, dur: 6 },
        { top: '28%', left: '88%', delay: 1.5, dur: 7 },
        { top: '65%', left: '18%', delay: 0.8, dur: 8 },
      ].map((p, i) => (
        <motion.div
          key={i}
          animate={{ y: [-8, 8, -8], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          className="absolute h-1 w-1 rounded-full bg-cyan-400/60"
          style={{ top: p.top, left: p.left }}
        />
      ))}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col justify-between px-12 xl:px-16 py-12 w-full"
      >
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] shadow-[0_0_24px_rgba(59,130,246,0.35)]">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">{APP_NAME}</span>
        </motion.div>

        <motion.div variants={fadeUp}>
          <h2 className="text-4xl xl:text-[3.25rem] font-extrabold text-white leading-[1.15] tracking-tight">
            Secure your
            <br />
            <span className="bg-gradient-to-r from-[#3B82F6] via-[#06B6D4] to-[#10B981] bg-clip-text text-transparent">
              account
            </span>
          </h2>
          <p className="mt-5 text-[17px] text-slate-400 max-w-md leading-relaxed">
            Choose a strong password to keep your patient data and treatment plans safe.
          </p>
          <div className="mt-10 flex items-center gap-4 rounded-2xl bg-white/[0.05] backdrop-blur-md border border-white/[0.08] px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/[0.06]">
              <Shield className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/90">Password Requirements</h3>
              <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                Min 8 chars, uppercase, number, and special character
              </p>
            </div>
          </div>
        </motion.div>

        <div />
      </motion.div>
    </div>
  );

  /* ================================================================ */
  /*  Invalid token state                                              */
  /* ================================================================ */
  if (!token) {
    return (
      <div className="flex min-h-screen bg-[#0A0F1E]">
        <LeftPanel />
        <div className="flex w-full items-center justify-center px-6 lg:w-[45%] bg-[#FAFBFC]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[420px] text-center"
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
            </div>
            <h1 className="text-[1.75rem] font-extrabold text-gray-900 tracking-tight">Invalid reset link</h1>
            <p className="mt-3 text-[15px] text-gray-500">This link is missing a reset token or has expired.</p>
            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:-translate-y-0.5 transition-all duration-300"
            >
              Request a new link
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  Success state                                                    */
  /* ================================================================ */
  if (success) {
    return (
      <div className="flex min-h-screen bg-[#0A0F1E]">
        <LeftPanel />
        <div className="flex w-full items-center justify-center px-6 lg:w-[45%] bg-[#FAFBFC]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[420px] text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100"
            >
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </motion.div>
            <h1 className="text-[1.75rem] font-extrabold text-gray-900 tracking-tight">Password reset!</h1>
            <p className="mt-3 text-[15px] text-gray-500">Your password has been changed. Redirecting to login...</p>
            <div className="mt-6 flex justify-center">
              <div className="h-1.5 w-32 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.5 }}
                  className="h-full bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] rounded-full"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  Main form                                                        */
  /* ================================================================ */
  return (
    <div className="flex min-h-screen bg-[#0A0F1E]">
      <LeftPanel />

      <div className="flex w-full items-center justify-center px-6 lg:w-[45%] bg-[#FAFBFC]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile header */}
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#06B6D4]">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">{APP_NAME}</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
              Set new password
            </h1>
            <p className="mt-2 text-[15px] text-gray-500">
              Must contain uppercase, number, and special character.
            </p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200/60 px-4 py-3.5 text-sm text-red-600"
            >
              <div className="h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
              {error}
            </motion.div>
          )}

          {/* Form card */}
          <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter new password"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-all duration-200 hover:border-gray-300 focus:border-[#3B82F6] focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Confirm new password"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-all duration-200 hover:border-gray-300 focus:border-[#3B82F6] focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/10"
                  />
                </div>
              </div>

              {/* Password strength hints */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: '8+ characters', met: password.length >= 8 },
                  { label: 'Uppercase', met: /[A-Z]/.test(password) },
                  { label: 'Number', met: /[0-9]/.test(password) },
                  { label: 'Special char', met: /[^A-Za-z0-9]/.test(password) },
                ].map((r) => (
                  <div key={r.label} className={`flex items-center gap-1.5 ${r.met ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${r.met ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    {r.label}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] text-sm font-semibold text-white shadow-md hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-300 active:scale-[0.98]"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center">
            <Link
              to={ROUTES.LOGIN}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#3B82F6] transition-colors"
            >
              Back to login
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
