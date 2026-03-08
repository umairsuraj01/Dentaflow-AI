// LoginPage.tsx — Split-screen login with animated gradient and form.

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
  { icon: Brain, title: 'AI Segmentation', desc: 'Automatic tooth segmentation powered by deep learning' },
  { icon: Shield, title: 'Secure Platform', desc: 'Enterprise-grade security for patient data' },
  { icon: Zap, title: 'Fast Turnaround', desc: 'Get treatment plans in hours, not days' },
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
      {/* Left: Gradient panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-navy via-slate-800 to-navy">
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 800 600">
            {Array.from({ length: 20 }, (_, i) => (
              <circle
                key={i}
                cx={100 + (i % 5) * 150}
                cy={80 + Math.floor(i / 5) * 140}
                r={3}
                fill="#3B82F6"
                opacity={0.5 + (i % 3) * 0.2}
              />
            ))}
            {Array.from({ length: 15 }, (_, i) => (
              <line
                key={`l-${i}`}
                x1={100 + (i % 5) * 150}
                y1={80 + Math.floor(i / 5) * 140}
                x2={100 + ((i + 1) % 5) * 150}
                y2={80 + Math.floor((i + 1) / 5) * 140}
                stroke="#3B82F6"
                strokeWidth={0.5}
                opacity={0.3}
              />
            ))}
          </svg>
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric">
                <Brain className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">{APP_NAME}</span>
            </div>
            <p className="mb-12 text-lg text-blue-200">{APP_TAGLINE}</p>
          </motion.div>
          <div className="space-y-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
                className="flex items-start gap-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-5 w-5 text-electric" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="text-sm text-blue-200/80">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`w-full max-w-md ${shakeForm ? 'animate-shake' : ''}`}
        >
          {/* Mobile header */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-dark-text">{APP_NAME}</span>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-dark-text">Welcome back</h1>
          <p className="mb-8 text-sm text-gray-500">Sign in to your account to continue</p>

          {form.errors.general && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
              {form.errors.general}
            </div>
          )}

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
                  className="text-gray-400 hover:text-gray-600"
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
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded border-gray-300" />
                Remember me
              </label>
              <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm font-medium text-electric hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" loading={form.isSubmitting}>
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link to={ROUTES.REGISTER} className="font-medium text-electric hover:underline">
              Create one
            </Link>
          </p>

          <div className="mt-10 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <span>Trusted by 500+ dental practices</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
