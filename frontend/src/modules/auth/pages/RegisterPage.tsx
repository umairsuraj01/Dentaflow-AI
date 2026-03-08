// RegisterPage.tsx — Multi-step registration with role selection and animated transitions.

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

const ROLE_OPTIONS = [
  {
    role: 'DENTIST' as UserRole,
    icon: Stethoscope,
    title: 'Dentist',
    description: 'Upload cases, review AI results, and manage your practice',
  },
  {
    role: 'TECHNICIAN' as UserRole,
    icon: Wrench,
    title: 'Technician',
    description: 'Process cases, create designs, and collaborate with dentists',
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-soft-gray px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg"
      >
        {/* Header */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-dark-text">{APP_NAME}</span>
        </div>

        {/* Progress stepper */}
        <div className="mb-8 flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300 ${
                  i + 1 <= step
                    ? 'bg-electric text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i + 1 < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded transition-colors duration-300 ${
                    i + 1 < step ? 'bg-electric' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {serverError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
            {serverError}
          </div>
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
                <h2 className="mb-2 text-lg font-semibold text-dark-text">Choose your account type</h2>
                <p className="mb-6 text-sm text-gray-500">Select how you will use the platform</p>
                <div className="space-y-4">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.role}
                      type="button"
                      onClick={() => setSelectedRole(opt.role)}
                      className={`flex w-full items-start gap-4 rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                        selectedRole === opt.role
                          ? 'border-electric bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                          selectedRole === opt.role ? 'bg-electric text-white' : 'bg-soft-gray text-gray-500'
                        }`}
                      >
                        <opt.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-dark-text">{opt.title}</h3>
                        <p className="text-sm text-gray-500">{opt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <Button type="button" onClick={handleStep1} disabled={!selectedRole}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
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
                <h2 className="mb-6 text-lg font-semibold text-dark-text">Personal information</h2>
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
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1">
                          {Array.from({ length: 4 }, (_, i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i < passwordStrength
                                  ? passwordStrength <= 2
                                    ? 'bg-red-400'
                                    : passwordStrength === 3
                                      ? 'bg-amber-400'
                                      : 'bg-mint'
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="space-y-0.5">
                          {PASSWORD_RULES.map((rule) => (
                            <p
                              key={rule.label}
                              className={`text-xs ${
                                rule.test(form.values.password as string)
                                  ? 'text-mint'
                                  : 'text-gray-400'
                              }`}
                            >
                              {rule.test(form.values.password as string) ? '✓' : '○'} {rule.label}
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
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="button" onClick={handleStep2}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
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
                <h2 className="mb-6 text-lg font-semibold text-dark-text">
                  {selectedRole === 'DENTIST' ? 'Practice details' : 'Professional details'}
                </h2>
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
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" loading={form.isSubmitting}>
                    Create Account
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="font-medium text-electric hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
