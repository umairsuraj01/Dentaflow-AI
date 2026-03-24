// LoginPage.tsx — Premium split-screen login with animated gradient and glassmorphism.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, Brain, Shield, Zap,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP_NAME, APP_TAGLINE, ROUTES } from '@/constants';
import { useAuth } from '../hooks/useAuth';
import { useAuthForm } from '../hooks/useAuthForm';

/* ------------------------------------------------------------------ */
/*  Feature cards for left panel                                       */
/* ------------------------------------------------------------------ */
const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Segmentation',
    desc: 'Deep learning models segment teeth in seconds with clinical accuracy.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
  {
    icon: Shield,
    title: 'Enterprise-Grade Security',
    desc: 'HIPAA-compliant encryption, audit trails, and role-based access.',
    gradient: 'from-violet-500/20 to-fuchsia-500/20',
    iconColor: 'text-violet-400',
  },
  {
    icon: Zap,
    title: 'Instant Treatment Plans',
    desc: 'Generate staging, attachments, and clinical reports in minutes.',
    gradient: 'from-amber-500/20 to-orange-500/20',
    iconColor: 'text-amber-400',
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Stagger animation helpers                                          */
/* ------------------------------------------------------------------ */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/* ================================================================== */
/*  LoginPage                                                          */
/* ================================================================== */
export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);

  const form = useAuthForm({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValid = form.validateEmail(form.values.email as string);
    if (!form.values.password) {
      form.setError('password', 'Password is required');
      return;
    }
    if (!emailValid) return;

    form.setIsSubmitting(true);
    try {
      await login({
        email: form.values.email as string,
        password: form.values.password as string,
      });
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Login failed. Please try again.';
      form.setError('general', message);
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 500);
    } finally {
      form.setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0A0F1E]">
      {/* ============================================================ */}
      {/*  LEFT PANEL — Rich animated gradient with floating elements   */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Deep navy-to-indigo animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A]" />

        {/* Subtle mesh/grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Radial glow accents */}
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

        {/* Floating particle dots */}
        {[
          { top: '12%', left: '72%', delay: 0, dur: 6 },
          { top: '28%', left: '88%', delay: 1.5, dur: 7 },
          { top: '65%', left: '18%', delay: 0.8, dur: 8 },
          { top: '78%', left: '65%', delay: 2, dur: 5.5 },
          { top: '42%', left: '35%', delay: 0.3, dur: 9 },
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

          {/* Hero text + glassmorphism feature cards */}
          <div>
            <motion.div variants={fadeUp}>
              <h2 className="text-4xl xl:text-[3.25rem] font-extrabold text-white leading-[1.15] tracking-tight">
                The future of
                <br />
                <span className="bg-gradient-to-r from-[#3B82F6] via-[#06B6D4] to-[#10B981] bg-clip-text text-transparent">
                  dental planning
                </span>
              </h2>
              <p className="mt-5 text-[17px] text-slate-400 max-w-md leading-relaxed">
                {APP_TAGLINE}. Harness AI to deliver precise, efficient treatment workflows.
              </p>
            </motion.div>

            <div className="mt-10 space-y-3">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  variants={fadeUp}
                  whileHover={{ x: 6, transition: { duration: 0.2 } }}
                >
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 4 + i * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
                    className="flex items-center gap-4 rounded-2xl bg-white/[0.05] backdrop-blur-md border border-white/[0.08] px-5 py-4 cursor-default
                               hover:bg-white/[0.09] hover:border-white/[0.14] transition-all duration-300"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} backdrop-blur-sm border border-white/[0.06]`}>
                      <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white/90">{f.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{f.desc}</p>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            {[
              { label: 'Your data is safe', icon: Shield },
              { label: 'Fast & reliable', icon: Zap },
              { label: 'AI-Powered', icon: Brain },
            ].map((badge) => (
              <div key={badge.label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-sm">
                <badge.icon className="h-3 w-3 text-slate-500" />
                <span className="text-[11px] font-medium text-slate-400">{badge.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL — Clean form                                     */}
      {/* ============================================================ */}
      <div className="flex w-full items-center justify-center px-6 lg:w-[45%] bg-[#FAFBFC]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`w-full max-w-[420px] ${shakeForm ? 'animate-shake' : ''}`}
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
              Welcome back
            </h1>
            <p className="mt-2 text-[15px] text-gray-500">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error alert */}
          {form.errors.general && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200/60 px-4 py-3.5 text-sm text-red-600"
              role="alert"
            >
              <div className="h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
              {form.errors.general}
            </motion.div>
          )}

          {/* Form card */}
          <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <Input
                label="Email"
                type="email"
                placeholder="you@clinic.com"
                icon={<Mail className="h-4 w-4" />}
                value={form.values.email as string}
                onChange={(e) => form.setValue('email', e.target.value)}
                error={form.errors.email}
                autoComplete="email"
              />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                icon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                value={form.values.password as string}
                onChange={(e) => form.setValue('password', e.target.value)}
                error={form.errors.password}
                autoComplete="current-password"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-[#3B82F6] focus:ring-[#3B82F6]/30 transition-shadow"
                  />
                  <span className="group-hover:text-gray-800 transition-colors">Remember me</span>
                </label>
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className="text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-shadow duration-300 text-white font-semibold rounded-xl"
                variant="gradient"
                loading={form.isSubmitting}
              >
                <span className="flex items-center justify-center gap-2">
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </form>
          </div>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>

          {/* Register CTA */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link
              to={ROUTES.REGISTER}
              className="font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
            >
              Create one free
            </Link>
          </p>

          {/* Footer note */}
          <p className="mt-10 text-center text-xs text-gray-400">
            Your data is protected with enterprise-grade security
          </p>
        </motion.div>
      </div>
    </div>
  );
}
