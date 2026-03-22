// ForgotPasswordPage.tsx — Request a password reset email.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle, Loader2, Brain } from 'lucide-react';
import { APP_NAME, ROUTES } from '@/constants';
import { authService } from '../services/auth.service';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50/80 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card border border-slate-200/60 text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-dark-text tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            If an account exists for <strong className="text-dark-text">{email}</strong>, we've sent a password reset link.
          </p>
          <Link
            to={ROUTES.LOGIN}
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-electric hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>
        </motion.div>
      </div>
    );
  }

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
            <Mail className="h-7 w-7 text-electric" />
          </div>
          <h1 className="text-center text-2xl font-bold text-dark-text tracking-tight">Forgot password?</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            No worries. Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@clinic.com"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-dark-text placeholder:text-slate-400 transition-all duration-200 focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/10"
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
              disabled={loading || !email}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-electric to-cyan-500 text-sm font-semibold text-white shadow-md shadow-electric/25 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <Link to={ROUTES.LOGIN} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-electric transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
