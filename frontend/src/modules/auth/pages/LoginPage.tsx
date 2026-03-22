// LoginPage.tsx — Premium split-screen login with animated mesh gradient and glassmorphism.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Brain, Shield, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP_NAME, APP_TAGLINE, ROUTES } from '@/constants';
import { useAuth } from '../hooks/useAuth';
import { useAuthForm } from '../hooks/useAuthForm';

const FEATURES = [
  { icon: Brain, title: 'AI Segmentation', desc: 'Deep learning tooth segmentation in seconds' },
  { icon: Shield, title: 'Enterprise Security', desc: 'HIPAA-ready encryption & access controls' },
  { icon: Zap, title: 'Instant Results', desc: 'Treatment plans delivered in hours, not days' },
] as const;

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
    <div className="flex min-h-screen">
      {/* Left: Premium mesh gradient panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden mesh-bg">
        {/* Animated floating orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ y: [-20, 20, -20], x: [-10, 10, -10] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[15%] left-[20%] h-72 w-72 rounded-full bg-electric/20 blur-[100px]"
          />
          <motion.div
            animate={{ y: [20, -20, 20], x: [10, -10, 10] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-[20%] right-[15%] h-64 w-64 rounded-full bg-mint/15 blur-[100px]"
          />
          <motion.div
            animate={{ y: [15, -15, 15] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[60%] left-[50%] h-48 w-48 rounded-full bg-purple-500/10 blur-[80px]"
          />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div className="relative z-10 flex flex-col justify-between px-12 xl:px-16 py-12 w-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-electric to-cyan-400 shadow-glow-blue">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">{APP_NAME}</span>
            </div>
          </motion.div>

          {/* Hero text + features */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
                The future of<br />
                <span className="bg-gradient-to-r from-electric via-cyan-400 to-mint bg-clip-text text-transparent">
                  dental planning
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-400 max-w-md leading-relaxed">
                {APP_TAGLINE}
              </p>
            </motion.div>

            <div className="mt-10 space-y-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.12 }}
                  className="flex items-center gap-4 rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] px-5 py-4 hover:bg-white/[0.1] transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-electric/20 to-cyan-400/20">
                    <f.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                    <p className="text-xs text-slate-400">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Trust badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex items-center gap-3 text-sm text-slate-500"
          >
            <div className="flex -space-x-2">
              {['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500'].map((color, i) => (
                <div key={i} className={`h-8 w-8 rounded-full ${color} border-2 border-navy flex items-center justify-center text-[10px] font-bold text-white`}>
                  {['JD', 'SK', 'MR', 'AL'][i]}
                </div>
              ))}
            </div>
            <span className="text-slate-400">Trusted by <strong className="text-white">2,500+</strong> dental professionals</span>
          </motion.div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-[45%] bg-gradient-to-b from-white to-slate-50/80">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`w-full max-w-[420px] ${shakeForm ? 'animate-shake' : ''}`}
        >
          {/* Mobile header */}
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-electric to-cyan-400">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-dark-text tracking-tight">{APP_NAME}</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-dark-text tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to your account to continue
          </p>

          {form.errors.general && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3.5 text-sm text-red-600"
              role="alert"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              {form.errors.general}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
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
                  className="text-slate-400 hover:text-slate-600 transition-colors"
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
              <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-electric focus:ring-electric/20" />
                Remember me
              </label>
              <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm font-medium text-electric hover:text-blue-700 transition-colors">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full h-11" variant="gradient" loading={form.isSubmitting}>
              Sign In
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">OR</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to={ROUTES.REGISTER} className="font-semibold text-electric hover:text-blue-700 transition-colors">
              Create one free
            </Link>
          </p>

          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-400">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-medium">4.9/5</span>
            <span className="text-slate-300">|</span>
            <span>500+ reviews</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
