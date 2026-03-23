// ForgotPasswordPage.tsx — Request a password reset email (split-screen layout matching Login).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle, Loader2, Brain, Shield, KeyRound } from 'lucide-react';
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

  return (
    <div className="flex min-h-screen bg-[#0A0F1E]">
      {/* ============================================================ */}
      {/*  LEFT PANEL — Animated gradient (matches Login)               */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Glow orbs */}
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

        {/* Floating particles */}
        {[
          { top: '12%', left: '72%', delay: 0, dur: 6 },
          { top: '28%', left: '88%', delay: 1.5, dur: 7 },
          { top: '65%', left: '18%', delay: 0.8, dur: 8 },
          { top: '78%', left: '65%', delay: 2, dur: 5.5 },
        ].map((p, i) => (
          <motion.div
            key={i}
            animate={{ y: [-8, 8, -8], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
            className="absolute h-1 w-1 rounded-full bg-cyan-400/60"
            style={{ top: p.top, left: p.left }}
          />
        ))}

        {/* Content */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 flex flex-col justify-between px-12 xl:px-16 py-12 w-full"
        >
          {/* Logo */}
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] shadow-[0_0_24px_rgba(59,130,246,0.35)]">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">{APP_NAME}</span>
          </motion.div>

          {/* Hero */}
          <div>
            <motion.div variants={fadeUp}>
              <h2 className="text-4xl xl:text-[3.25rem] font-extrabold text-white leading-[1.15] tracking-tight">
                Account
                <br />
                <span className="bg-gradient-to-r from-[#3B82F6] via-[#06B6D4] to-[#10B981] bg-clip-text text-transparent">
                  recovery
                </span>
              </h2>
              <p className="mt-5 text-[17px] text-slate-400 max-w-md leading-relaxed">
                We take your account security seriously. Reset your password securely in just a few steps.
              </p>
            </motion.div>

            <div className="mt-10 space-y-3">
              {[
                { icon: Shield, title: 'Secure Reset Process', desc: 'Encrypted token-based password recovery.', gradient: 'from-violet-500/20 to-fuchsia-500/20', iconColor: 'text-violet-400' },
                { icon: Mail, title: 'Email Verification', desc: 'Reset link sent directly to your registered email.', gradient: 'from-blue-500/20 to-cyan-500/20', iconColor: 'text-cyan-400' },
                { icon: KeyRound, title: 'Instant Access', desc: 'Set a new password and get back to work immediately.', gradient: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400' },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  variants={fadeUp}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 4 + i * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
                  className="flex items-center gap-4 rounded-2xl bg-white/[0.05] backdrop-blur-md border border-white/[0.08] px-5 py-4 hover:bg-white/[0.09] hover:border-white/[0.14] transition-all duration-300"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} border border-white/[0.06]`}>
                    <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white/90">{f.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div />
        </motion.div>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL — Form                                           */}
      {/* ============================================================ */}
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

          {sent ? (
            /* Success state */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                >
                  <CheckCircle className="h-10 w-10 text-emerald-500" />
                </motion.div>
              </div>
              <h1 className="text-[1.75rem] font-extrabold text-gray-900 tracking-tight">Check your email</h1>
              <p className="mt-3 text-[15px] text-gray-500 leading-relaxed">
                If an account exists for <strong className="text-gray-800">{email}</strong>, we&apos;ve sent a password reset link.
              </p>
              <Link
                to={ROUTES.LOGIN}
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back to login
              </Link>
            </motion.div>
          ) : (
            /* Form state */
            <>
              <div className="mb-8">
                <h1 className="text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
                  Forgot password?
                </h1>
                <p className="mt-2 text-[15px] text-gray-500">
                  No worries. Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

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

              <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@clinic.com"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-all duration-200 hover:border-gray-300 focus:border-[#3B82F6] focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/10"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] text-sm font-semibold text-white shadow-md hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-300 active:scale-[0.98]"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              </div>

              <p className="mt-6 text-center">
                <Link
                  to={ROUTES.LOGIN}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#3B82F6] transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to login
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
