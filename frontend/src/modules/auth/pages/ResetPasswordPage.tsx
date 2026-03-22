// ResetPasswordPage.tsx — Set a new password using a reset token.

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, CheckCircle, AlertTriangle, Brain } from 'lucide-react';
import { APP_NAME, ROUTES } from '@/constants';
import { authService } from '../services/auth.service';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate(ROUTES.LOGIN, { replace: true }), 2500);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50/80 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card border border-slate-200/60 text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-dark-text tracking-tight">Invalid reset link</h1>
          <p className="mt-3 text-sm text-slate-500">This link is missing a reset token or has expired.</p>
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-electric to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-electric/25 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            Request a new link
          </Link>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50/80 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card border border-slate-200/60 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50"
          >
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </motion.div>
          <h1 className="text-2xl font-bold text-dark-text tracking-tight">Password reset!</h1>
          <p className="mt-3 text-sm text-slate-500">Your password has been changed. Redirecting to login...</p>
          <div className="mt-4 flex justify-center">
            <div className="h-1 w-24 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.5 }}
                className="h-full bg-gradient-to-r from-electric to-mint rounded-full"
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

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
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.detail || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50/80 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-electric to-cyan-400">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-dark-text tracking-tight">{APP_NAME}</span>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-card border border-slate-200/60">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50">
            <Lock className="h-7 w-7 text-electric" />
          </div>
          <h1 className="text-center text-2xl font-bold text-dark-text tracking-tight">Set new password</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Must contain uppercase, number, and special character.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-dark-text transition-all duration-200 focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-dark-text transition-all duration-200 focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/10"
              />
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-red-600"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {error}
              </motion.p>
            )}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-electric to-cyan-500 text-sm font-semibold text-white shadow-md shadow-electric/25 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
