// RegisterPage.tsx — Multi-step registration with premium design.

import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Stethoscope, Wrench, ArrowLeft, ArrowRight,
  Mail, Lock, User as UserIcon, Building, Globe, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP_NAME, ROUTES } from '@/constants';
import type { UserRole } from '@/types/common';
import { useAuth } from '../hooks/useAuth';
import { useAuthForm } from '../hooks/useAuthForm';
import { PASSWORD_RULES } from '../constants/auth.constants';

const TOTAL_STEPS = 3;
const STEP_LABELS = ['Account Type', 'Your Details', 'Practice Info'];

const ROLE_OPTIONS = [
  {
    role: 'DENTIST' as UserRole,
    icon: Stethoscope,
    title: 'Dentist',
    description: 'Upload cases, review AI results, and manage your practice',
    gradient: 'from-electric to-cyan-400',
  },
  {
    role: 'TECHNICIAN' as UserRole,
    icon: Wrench,
    title: 'Technician',
    description: 'Process cases, create designs, and collaborate with dentists',
    gradient: 'from-mint to-emerald-400',
  },
] as const;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [serverError, setServerError] = useState('');

  const form = useAuthForm({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    clinic_name: '',
    country: '',
    specialization: '',
    experience_years: '',
  });

  const nextStep = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const prevStep = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleStep1 = useCallback(() => {
    if (!selectedRole) return;
    nextStep();
  }, [selectedRole, nextStep]);

  const handleStep2 = useCallback(() => {
    const nameValid = form.validateRequired('full_name', 'Full name');
    const emailValid = form.validateEmail(form.values.email as string);
    const pwValid = form.validatePassword(form.values.password as string);
    if (form.values.password !== form.values.confirm_password) {
      form.setError('confirm_password', 'Passwords do not match');
      return;
    }
    if (nameValid && emailValid && pwValid) nextStep();
  }, [form, nextStep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    form.setIsSubmitting(true);
    setServerError('');
    try {
      await register({
        email: form.values.email as string,
        password: form.values.password as string,
        full_name: form.values.full_name as string,
        role: selectedRole,
        clinic_name: (form.values.clinic_name as string) || undefined,
        country: (form.values.country as string) || undefined,
        specialization: (form.values.specialization as string) || undefined,
        experience_years: form.values.experience_years
          ? Number(form.values.experience_years)
          : undefined,
      });
      navigate(ROUTES.LOGIN, { state: { registered: true } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed.';
      setServerError(msg);
    } finally {
      form.setIsSubmitting(false);
    }
  };

  const passwordStrength = form.getPasswordStrength(form.values.password as string);
  const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-mint'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="flex min-h-screen">
      {/* Left: Decorative mesh panel (desktop only) */}
      <div className="hidden xl:flex xl:w-[45%] relative overflow-hidden mesh-bg">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ y: [-20, 20, -20] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[20%] left-[25%] h-64 w-64 rounded-full bg-electric/20 blur-[100px]"
          />
          <motion.div
            animate={{ y: [20, -20, 20] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-[25%] right-[20%] h-56 w-56 rounded-full bg-mint/15 blur-[100px]"
          />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-electric to-cyan-400 shadow-glow-blue">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">{APP_NAME}</span>
          </div>
          <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight">
            Join the future of<br />
            <span className="bg-gradient-to-r from-electric via-cyan-400 to-mint bg-clip-text text-transparent">
              dental innovation
            </span>
          </h2>
          <p className="mt-4 text-slate-400 max-w-sm leading-relaxed">
            Create your account and start leveraging AI-powered treatment planning today.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Check className="h-4 w-4 text-mint" />
              Free to start
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Check className="h-4 w-4 text-mint" />
              No credit card
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Check className="h-4 w-4 text-mint" />
              Cancel anytime
            </div>
          </div>
        </div>
      </div>

      {/* Right: Registration form */}
      <div className="flex w-full items-center justify-center px-4 py-8 xl:w-[55%] bg-gradient-to-b from-white to-slate-50/80">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          {/* Mobile header */}
          <div className="mb-6 flex items-center gap-2.5 xl:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-electric to-cyan-400">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-dark-text tracking-tight">{APP_NAME}</span>
          </div>

          <div className="rounded-2xl bg-white shadow-card border border-slate-200/60 p-6 sm:p-8">
            {/* Progress stepper */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ flex: i < TOTAL_STEPS - 1 ? 1 : 'none' }}>
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                        i + 1 < step
                          ? 'bg-gradient-to-br from-electric to-cyan-400 text-white shadow-md shadow-electric/25'
                          : i + 1 === step
                            ? 'bg-electric text-white shadow-md shadow-electric/25'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {i + 1 < step ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    {i < TOTAL_STEPS - 1 && (
                      <div className="h-0.5 flex-1 rounded mx-2">
                        <div
                          className={`h-full rounded transition-all duration-500 ${
                            i + 1 < step ? 'bg-gradient-to-r from-electric to-cyan-400 w-full' : 'bg-slate-100 w-full'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-1">
                {STEP_LABELS.map((label, i) => (
                  <span key={label} className={`text-[11px] font-medium ${i + 1 <= step ? 'text-electric' : 'text-slate-400'}`}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3.5 text-sm text-red-600"
                role="alert"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {serverError}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <AnimatePresence mode="wait" custom={direction}>
                {step === 1 && (
                  <motion.div
                    key="step1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="text-xl font-bold text-dark-text tracking-tight">Choose your account type</h2>
                    <p className="mt-1 mb-6 text-sm text-slate-500">Select how you will use the platform</p>
                    <div className="space-y-3">
                      {ROLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.role}
                          type="button"
                          onClick={() => setSelectedRole(opt.role)}
                          className={`flex w-full items-start gap-4 rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                            selectedRole === opt.role
                              ? 'border-electric bg-blue-50/50 shadow-md shadow-electric/10'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                              selectedRole === opt.role
                                ? `bg-gradient-to-br ${opt.gradient} text-white shadow-md`
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <opt.icon className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-dark-text">{opt.title}</h3>
                            <p className="text-sm text-slate-500 mt-0.5">{opt.description}</p>
                          </div>
                          {selectedRole === opt.role && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-electric text-white"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </motion.div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button type="button" variant="gradient" onClick={handleStep1} disabled={!selectedRole}>
                        Continue <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="text-xl font-bold text-dark-text tracking-tight">Personal information</h2>
                    <p className="mt-1 mb-6 text-sm text-slate-500">Tell us about yourself</p>
                    <div className="space-y-4">
                      <Input
                        label="Full Name"
                        placeholder="Dr. Jane Smith"
                        icon={<UserIcon className="h-4 w-4" />}
                        value={form.values.full_name as string}
                        onChange={(e) => form.setValue('full_name', e.target.value)}
                        error={form.errors.full_name}
                      />
                      <Input
                        label="Email"
                        type="email"
                        placeholder="you@clinic.com"
                        icon={<Mail className="h-4 w-4" />}
                        value={form.values.email as string}
                        onChange={(e) => form.setValue('email', e.target.value)}
                        error={form.errors.email}
                      />
                      <div>
                        <Input
                          label="Password"
                          type="password"
                          placeholder="Create a strong password"
                          icon={<Lock className="h-4 w-4" />}
                          value={form.values.password as string}
                          onChange={(e) => form.setValue('password', e.target.value)}
                          error={form.errors.password}
                        />
                        {(form.values.password as string).length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="flex flex-1 gap-1">
                                {Array.from({ length: 4 }, (_, i) => (
                                  <div
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                      i < passwordStrength ? strengthColors[Math.min(passwordStrength - 1, 3)] : 'bg-slate-200'
                                    }`}
                                  />
                                ))}
                              </div>
                              {passwordStrength > 0 && (
                                <span className={`text-[11px] font-semibold ${
                                  passwordStrength <= 2 ? 'text-red-500' : passwordStrength === 3 ? 'text-amber-500' : 'text-mint'
                                }`}>
                                  {strengthLabels[Math.min(passwordStrength - 1, 3)]}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {PASSWORD_RULES.map((rule) => (
                                <p
                                  key={rule.label}
                                  className={`flex items-center gap-1.5 text-xs transition-colors ${
                                    rule.test(form.values.password as string) ? 'text-mint' : 'text-slate-400'
                                  }`}
                                >
                                  {rule.test(form.values.password as string) ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <span className="h-3 w-3 flex items-center justify-center">
                                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                                    </span>
                                  )}
                                  {rule.label}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Input
                        label="Confirm Password"
                        type="password"
                        placeholder="Re-enter your password"
                        icon={<Lock className="h-4 w-4" />}
                        value={form.values.confirm_password as string}
                        onChange={(e) => form.setValue('confirm_password', e.target.value)}
                        error={form.errors.confirm_password}
                      />
                    </div>
                    <div className="mt-6 flex justify-between">
                      <Button type="button" variant="ghost" onClick={prevStep}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                      </Button>
                      <Button type="button" variant="gradient" onClick={handleStep2}>
                        Continue <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="text-xl font-bold text-dark-text tracking-tight">
                      {selectedRole === 'DENTIST' ? 'Practice details' : 'Professional details'}
                    </h2>
                    <p className="mt-1 mb-6 text-sm text-slate-500">Almost there! Just a few more details</p>
                    <div className="space-y-4">
                      {selectedRole === 'DENTIST' ? (
                        <>
                          <Input
                            label="Clinic Name"
                            placeholder="Smile Dental Clinic"
                            icon={<Building className="h-4 w-4" />}
                            value={form.values.clinic_name as string}
                            onChange={(e) => form.setValue('clinic_name', e.target.value)}
                          />
                          <Input
                            label="Country"
                            placeholder="United States"
                            icon={<Globe className="h-4 w-4" />}
                            value={form.values.country as string}
                            onChange={(e) => form.setValue('country', e.target.value)}
                          />
                        </>
                      ) : (
                        <>
                          <Input
                            label="Specialization"
                            placeholder="e.g. Orthodontic Design"
                            icon={<Wrench className="h-4 w-4" />}
                            value={form.values.specialization as string}
                            onChange={(e) => form.setValue('specialization', e.target.value)}
                          />
                          <Input
                            label="Years of Experience"
                            type="number"
                            placeholder="5"
                            value={form.values.experience_years as string}
                            onChange={(e) => form.setValue('experience_years', e.target.value)}
                          />
                        </>
                      )}
                    </div>
                    <div className="mt-6 flex justify-between">
                      <Button type="button" variant="ghost" onClick={prevStep}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                      </Button>
                      <Button type="submit" variant="gradient" loading={form.isSubmitting}>
                        Create Account
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className="font-semibold text-electric hover:text-blue-700 transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
