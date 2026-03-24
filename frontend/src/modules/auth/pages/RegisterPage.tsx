// RegisterPage.tsx — Premium split-screen multi-step registration.

import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Stethoscope, Wrench, ArrowLeft, ArrowRight,
  Mail, Lock, User as UserIcon, Building, Globe, Check,
  Sparkles, ShieldCheck, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP_NAME, ROUTES } from '@/constants';
import type { UserRole } from '@/types/common';
import { useAuth } from '../hooks/useAuth';
import { useAuthForm } from '../hooks/useAuthForm';
import { PASSWORD_RULES } from '../constants/auth.constants';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TOTAL_STEPS = 3;
const STEP_LABELS = ['Account Type', 'Your Details', 'Organization'];

const ROLE_OPTIONS = [
  {
    role: 'DENTIST' as UserRole,
    icon: Stethoscope,
    title: 'Dentist',
    description: 'Upload cases, review AI results, and manage your practice',
    gradient: 'from-[#3B82F6] to-[#06B6D4]',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
  },
  {
    role: 'TECHNICIAN' as UserRole,
    icon: Wrench,
    title: 'Technician',
    description: 'Process cases, run AI segmentation, and create aligners',
    gradient: 'from-[#10B981] to-[#06B6D4]',
    bgGradient: 'from-emerald-500/10 to-cyan-500/10',
  },
  {
    role: 'LAB_MANAGER' as UserRole,
    icon: Building,
    title: 'Lab Manager',
    description: 'Oversee production, manage team, and track manufacturing orders',
    gradient: 'from-[#8B5CF6] to-[#EC4899]',
    bgGradient: 'from-violet-500/10 to-pink-500/10',
  },
] as const;

const SELLING_POINTS = [
  { icon: Sparkles, text: 'Free to start' },
  { icon: ShieldCheck, text: 'No credit card' },
  { icon: Clock, text: 'Cancel anytime' },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/* ================================================================== */
/*  RegisterPage                                                       */
/* ================================================================== */
export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [serverError, setServerError] = useState('');

  const [orgMode, setOrgMode] = useState<'create' | 'join'>('create');

  const form = useAuthForm({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    clinic_name: '',
    country: '',
    specialization: '',
    experience_years: '',
    org_name: '',
    invite_token: '',
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
        org_name: orgMode === 'create' ? (form.values.org_name as string) || undefined : undefined,
        invite_token: orgMode === 'join' ? (form.values.invite_token as string) || undefined : undefined,
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
  const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-400'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="flex min-h-screen bg-[#0A0F1E]">
      {/* ============================================================ */}
      {/*  LEFT PANEL — Animated gradient with floating elements        */}
      {/* ============================================================ */}
      <div className="hidden xl:flex xl:w-[45%] relative overflow-hidden">
        {/* Deep navy-to-indigo gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A]" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Animated glow orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ y: [-25, 25, -25], x: [-10, 10, -10], scale: [1, 1.08, 1] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[15%] left-[20%] h-[380px] w-[380px] rounded-full bg-[#3B82F6]/[0.12] blur-[120px]"
          />
          <motion.div
            animate={{ y: [20, -20, 20], x: [8, -8, 8], scale: [1.04, 0.96, 1.04] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-[20%] right-[15%] h-[320px] w-[320px] rounded-full bg-[#06B6D4]/[0.10] blur-[120px]"
          />
          <motion.div
            animate={{ y: [15, -15, 15] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[58%] left-[48%] h-[260px] w-[260px] rounded-full bg-[#8B5CF6]/[0.08] blur-[100px]"
          />
        </div>

        {/* Floating particles */}
        {[
          { top: '18%', left: '75%', delay: 0, dur: 7 },
          { top: '35%', left: '85%', delay: 1, dur: 6 },
          { top: '72%', left: '22%', delay: 0.5, dur: 8 },
          { top: '85%', left: '60%', delay: 2, dur: 5 },
        ].map((p, i) => (
          <motion.div
            key={i}
            animate={{ y: [-6, 6, -6], opacity: [0.3, 0.7, 0.3] }}
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
          className="relative z-10 flex flex-col justify-center px-12 xl:px-16 w-full"
        >
          {/* Logo */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 mb-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] shadow-[0_0_24px_rgba(59,130,246,0.35)]">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">{APP_NAME}</span>
          </motion.div>

          {/* Hero */}
          <motion.div variants={fadeUp}>
            <h2 className="text-3xl xl:text-[2.75rem] font-extrabold text-white leading-[1.15] tracking-tight">
              Join the future of
              <br />
              <span className="bg-gradient-to-r from-[#3B82F6] via-[#06B6D4] to-[#10B981] bg-clip-text text-transparent">
                dental innovation
              </span>
            </h2>
            <p className="mt-5 text-[17px] text-slate-400 max-w-sm leading-relaxed">
              Create your account and start leveraging AI-powered treatment planning today.
            </p>
          </motion.div>

          {/* Selling points */}
          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-5">
            {SELLING_POINTS.map((sp) => (
              <div
                key={sp.text}
                className="flex items-center gap-2.5 rounded-full bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] px-4 py-2.5"
              >
                <sp.icon className="h-4 w-4 text-[#06B6D4]" />
                <span className="text-sm font-medium text-slate-300">{sp.text}</span>
              </div>
            ))}
          </motion.div>

          {/* Stats bar */}
          <motion.div variants={fadeUp} className="mt-12 flex gap-8">
            {[
              { value: '2,500+', label: 'Clinics' },
              { value: '150K+', label: 'Cases' },
              { value: '99.2%', label: 'Accuracy' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-extrabold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL — Registration form                              */}
      {/* ============================================================ */}
      <div className="flex w-full items-center justify-center px-4 py-8 xl:w-[55%] bg-[#FAFBFC]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg"
        >
          {/* Mobile header */}
          <div className="mb-6 flex items-center gap-2.5 xl:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#06B6D4]">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">{APP_NAME}</span>
          </div>

          {/* Form card */}
          <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-6 sm:p-8">
            {/* Progress stepper */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ flex: i < TOTAL_STEPS - 1 ? 1 : 'none' }}>
                    <motion.div
                      animate={i + 1 === step ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.3 }}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${
                        i + 1 < step
                          ? 'bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                          : i + 1 === step
                            ? 'bg-[#3B82F6] text-white shadow-[0_0_16px_rgba(59,130,246,0.35)]'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {i + 1 < step ? <Check className="h-4 w-4" /> : i + 1}
                    </motion.div>
                    {i < TOTAL_STEPS - 1 && (
                      <div className="h-0.5 flex-1 rounded mx-2 bg-gray-100 overflow-hidden">
                        <motion.div
                          initial={{ width: '0%' }}
                          animate={{ width: i + 1 < step ? '100%' : '0%' }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full bg-gradient-to-r from-[#3B82F6] to-[#06B6D4]"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-1">
                {STEP_LABELS.map((label, i) => (
                  <span
                    key={label}
                    className={`text-[11px] font-medium transition-colors duration-300 ${
                      i + 1 <= step ? 'text-[#3B82F6]' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Server error */}
            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mb-5 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200/60 px-4 py-3.5 text-sm text-red-600"
                role="alert"
              >
                <div className="h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                {serverError}
              </motion.div>
            )}

            {/* Multi-step form */}
            <form onSubmit={handleSubmit} noValidate>
              <AnimatePresence mode="wait" custom={direction}>
                {/* Step 1: Role selection */}
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
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Choose your account type</h2>
                    <p className="mt-1 mb-6 text-sm text-gray-500">Select how you will use the platform</p>
                    <div className="space-y-3">
                      {ROLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.role}
                          type="button"
                          onClick={() => setSelectedRole(opt.role)}
                          className={`group flex w-full items-start gap-4 rounded-xl border-2 p-5 text-left transition-all duration-300 ${
                            selectedRole === opt.role
                              ? 'border-[#3B82F6] bg-blue-50/60 shadow-[0_0_0_1px_rgba(59,130,246,0.1),0_4px_16px_rgba(59,130,246,0.1)]'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 hover:shadow-sm'
                          }`}
                        >
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                              selectedRole === opt.role
                                ? `bg-gradient-to-br ${opt.gradient} text-white shadow-lg shadow-blue-500/20`
                                : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200/80'
                            }`}
                          >
                            <opt.icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900">{opt.title}</h3>
                            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{opt.description}</p>
                          </div>
                          {selectedRole === opt.role && (
                            <motion.div
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-md"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </motion.div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button
                        type="button"
                        variant="gradient"
                        onClick={handleStep1}
                        disabled={!selectedRole}
                        className="bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-shadow duration-300"
                      >
                        Continue <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Personal details */}
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
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Personal information</h2>
                    <p className="mt-1 mb-6 text-sm text-gray-500">Tell us about yourself</p>
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
                          <div className="mt-3 space-y-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex flex-1 gap-1">
                                {Array.from({ length: 4 }, (_, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ duration: 0.3, delay: i * 0.05 }}
                                    className={`h-1.5 flex-1 rounded-full origin-left transition-colors duration-500 ${
                                      i < passwordStrength ? strengthColors[Math.min(passwordStrength - 1, 3)] : 'bg-gray-200'
                                    }`}
                                  />
                                ))}
                              </div>
                              {passwordStrength > 0 && (
                                <span className={`text-[11px] font-semibold ${
                                  passwordStrength <= 2 ? 'text-red-500' : passwordStrength === 3 ? 'text-amber-500' : 'text-emerald-500'
                                }`}>
                                  {strengthLabels[Math.min(passwordStrength - 1, 3)]}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              {PASSWORD_RULES.map((rule) => {
                                const passed = rule.test(form.values.password as string);
                                return (
                                  <p
                                    key={rule.label}
                                    className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                                      passed ? 'text-emerald-500' : 'text-gray-400'
                                    }`}
                                  >
                                    {passed ? (
                                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                        <Check className="h-3 w-3" />
                                      </motion.span>
                                    ) : (
                                      <span className="h-3 w-3 flex items-center justify-center">
                                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                                      </span>
                                    )}
                                    {rule.label}
                                  </p>
                                );
                              })}
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
                      <Button type="button" variant="ghost" onClick={prevStep} className="text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                      </Button>
                      <Button
                        type="button"
                        variant="gradient"
                        onClick={handleStep2}
                        className="bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-shadow duration-300"
                      >
                        Continue <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Practice/professional details */}
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
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                      Organization
                    </h2>
                    <p className="mt-1 mb-6 text-sm text-gray-500">Create a new organization or join an existing one</p>

                    {/* Org mode toggle */}
                    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-5">
                      <button
                        type="button"
                        onClick={() => setOrgMode('create')}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          orgMode === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Building className="inline mr-1.5 h-4 w-4" />
                        Create New
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrgMode('join')}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          orgMode === 'join' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Mail className="inline mr-1.5 h-4 w-4" />
                        Join via Invite
                      </button>
                    </div>

                    <div className="space-y-4">
                      {orgMode === 'create' ? (
                        <>
                          <Input
                            label="Organization Name"
                            placeholder="e.g. Smile Dental Lab"
                            icon={<Building className="h-4 w-4" />}
                            value={form.values.org_name as string}
                            onChange={(e) => form.setValue('org_name', e.target.value)}
                          />
                          {selectedRole === 'DENTIST' && (
                            <Input
                              label="Clinic Name (optional)"
                              placeholder="Your clinic name"
                              value={form.values.clinic_name as string}
                              onChange={(e) => form.setValue('clinic_name', e.target.value)}
                            />
                          )}
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
                            label="Invite Token"
                            placeholder="Paste the invite token from your admin"
                            icon={<Mail className="h-4 w-4" />}
                            value={form.values.invite_token as string}
                            onChange={(e) => form.setValue('invite_token', e.target.value)}
                          />
                          <p className="text-xs text-gray-400">
                            Ask your organization admin for an invite token. You'll automatically join their team.
                          </p>
                        </>
                      )}
                    </div>
                    <div className="mt-6 flex justify-between">
                      <Button type="button" variant="ghost" onClick={prevStep} className="text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                      </Button>
                      <Button
                        type="submit"
                        variant="gradient"
                        loading={form.isSubmitting}
                        className="bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-shadow duration-300"
                      >
                        Create Account
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          {/* Sign in link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className="font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
