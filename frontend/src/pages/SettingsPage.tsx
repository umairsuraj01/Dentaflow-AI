// SettingsPage.tsx — User settings: profile, security, and preferences.

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Bell, Palette, Loader2, CheckCircle, Sun, Moon, Monitor, Settings, Mail, ExternalLink } from 'lucide-react';
import { useAuthStore, authService } from '@/modules/auth';
import { APP_SUPPORT_EMAIL } from '@/constants';

const COUNTRIES = [
  '', 'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
  'Bahrain', 'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'Chile', 'China',
  'Colombia', 'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France',
  'Germany', 'Greece', 'Hong Kong', 'Hungary', 'India', 'Indonesia', 'Iran',
  'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kenya', 'Kuwait',
  'Lebanon', 'Malaysia', 'Mexico', 'Morocco', 'Netherlands', 'New Zealand',
  'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore',
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
  'Taiwan', 'Thailand', 'Turkey', 'UAE', 'United Kingdom', 'United States',
  'Vietnam',
];

const TIMEZONES = [
  '', 'UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Shanghai',
  'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland',
];

type Tab = 'profile' | 'security' | 'preferences';

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'preferences', label: 'Preferences', icon: Palette },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-electric/10 to-cyan-500/10">
            <Settings className="h-4 w-4 text-electric" />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Account</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-electric via-blue-600 to-cyan-500 bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account, security, and preferences.</p>
      </div>

      {/* Pill Tab Bar */}
      <div className="flex gap-1.5 rounded-2xl bg-slate-100/80 p-1.5 backdrop-blur-sm border border-slate-200/40">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
              tab === t.key
                ? 'bg-white text-dark-text shadow-md shadow-slate-200/50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === t.key && (
              <motion.div
                layoutId="settings-tab-pill"
                className="absolute inset-0 rounded-xl bg-white shadow-md shadow-slate-200/50"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <t.icon className={`h-4 w-4 transition-colors duration-200 ${tab === t.key ? 'text-electric' : ''}`} />
              <span className="hidden sm:inline">{t.label}</span>
            </span>
            {tab === t.key && (
              <motion.span
                layoutId="settings-tab-dot"
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-gradient-to-r from-electric to-cyan-500"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {tab === 'profile' && <ProfileTab />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'preferences' && <PreferencesTab />}
      </motion.div>
    </div>
  );
}

/* -- Profile Tab -- */

function ProfileTab() {
  const { user, setUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    clinic_name: user?.clinic_name || '',
    specialization: user?.specialization || '',
    experience_years: user?.experience_years ?? '',
    country: user?.country || '',
    timezone: user?.timezone || '',
  });

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const updated = await authService.updateProfile({
        full_name: form.full_name || undefined,
        clinic_name: form.clinic_name || undefined,
        specialization: form.specialization || undefined,
        experience_years: form.experience_years ? Number(form.experience_years) : undefined,
        country: form.country || undefined,
        timezone: form.timezone || undefined,
      });
      setUser(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-8 shadow-card border border-slate-200/60">
      <div className="mb-8">
        <h2 className="text-lg font-bold text-dark-text tracking-tight">Profile Information</h2>
        <p className="text-sm text-slate-400 mt-0.5">Update your personal and professional details.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <Field label="Email" value={user?.email || ''} disabled />
        <Field label="Clinic Name" value={form.clinic_name} onChange={(v) => setForm({ ...form, clinic_name: v })} />
        <Field label="Specialization" value={form.specialization} onChange={(v) => setForm({ ...form, specialization: v })} />
        <Field label="Experience (years)" value={String(form.experience_years)} type="number" onChange={(v) => setForm({ ...form, experience_years: v })} />
        <SelectField
          label="Country"
          value={form.country}
          options={COUNTRIES}
          onChange={(v) => setForm({ ...form, country: v })}
        />
        <SelectField
          label="Timezone"
          value={form.timezone}
          options={TIMEZONES}
          onChange={(v) => setForm({ ...form, timezone: v })}
        />
        <Field label="Role" value={user?.role?.replace('_', ' ') || ''} disabled />
      </div>
      {error && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" /> {error}
        </motion.div>
      )}
      {success && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4 shrink-0" /> Profile updated successfully
        </motion.div>
      )}
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-electric to-cyan-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-electric/20 hover:shadow-xl hover:shadow-electric/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-300 active:scale-[0.97]"
        >
          <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-electric to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
          <span className="relative flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </span>
        </button>
      </div>
    </div>
  );
}

/* -- Security Tab -- */

function SecurityTab() {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });

  const handleChange = async () => {
    if (form.newPw !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.newPw.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await authService.changePassword(form.current, form.newPw);
      setForm({ current: '', newPw: '', confirm: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.detail || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-8 shadow-card border border-slate-200/60">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
            <Shield className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-dark-text tracking-tight">Change Password</h2>
            <p className="text-sm text-slate-400">Must contain uppercase, number, and special character.</p>
          </div>
        </div>
      </div>
      <div className="max-w-md space-y-5">
        <Field label="Current Password" value={form.current} type="password" onChange={(v) => setForm({ ...form, current: v })} />
        <Field label="New Password" value={form.newPw} type="password" onChange={(v) => setForm({ ...form, newPw: v })} />
        <Field label="Confirm New Password" value={form.confirm} type="password" onChange={(v) => setForm({ ...form, confirm: v })} />
      </div>
      {error && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" /> {error}
        </motion.div>
      )}
      {success && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4 shrink-0" /> Password changed successfully
        </motion.div>
      )}
      <div className="mt-8">
        <button
          onClick={handleChange}
          disabled={saving || !form.current || !form.newPw}
          className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-electric to-cyan-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-electric/20 hover:shadow-xl hover:shadow-electric/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-300 active:scale-[0.97]"
        >
          <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-electric to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
          <span className="relative flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Updating...' : 'Change Password'}
          </span>
        </button>
      </div>
    </div>
  );
}

/* -- Preferences Tab -- */

function PreferencesTab() {
  const [theme, setTheme] = useState(() => localStorage.getItem('df-theme') || 'light');
  const [emailNotifs, setEmailNotifs] = useState(() => localStorage.getItem('df-email-notifs') !== 'false');
  const [pushNotifs, setPushNotifs] = useState(false);
  const [pushStatus, setPushStatus] = useState('');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if ('Notification' in window) {
      setPushNotifs(Notification.permission === 'granted');
      if (Notification.permission === 'denied') {
        setPushStatus('Blocked by browser. Enable in browser settings.');
      }
    } else {
      setPushStatus('Not supported in this browser.');
    }
  }, []);

  const updateTheme = (v: string) => {
    setTheme(v);
    localStorage.setItem('df-theme', v);
    applyTheme(v);
  };

  const togglePush = async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') {
      setPushStatus('Blocked by browser. Please enable in browser settings.');
      return;
    }
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        setPushNotifs(true);
        setPushStatus('');
        new Notification('DentaFlow AI', { body: 'Push notifications enabled!' });
      } else {
        setPushNotifs(false);
        setPushStatus('Permission denied.');
      }
    } else {
      setPushNotifs(!pushNotifs);
    }
  };

  const themeOptions = [
    { key: 'light', label: 'Light', icon: Sun, desc: 'Clean & bright' },
    { key: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
    { key: 'system', label: 'System', icon: Monitor, desc: 'Match your OS' },
  ];

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="rounded-2xl bg-white p-8 shadow-card border border-slate-200/60">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-dark-text tracking-tight">Appearance</h2>
          <p className="text-sm text-slate-400 mt-0.5">Choose how DentaFlow looks for you.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {themeOptions.map((t) => (
            <button
              key={t.key}
              onClick={() => updateTheme(t.key)}
              className={`group relative flex flex-col items-center gap-3 rounded-2xl px-4 py-6 text-center transition-all duration-300 ${
                theme === t.key
                  ? 'bg-gradient-to-b from-white to-blue-50/50 shadow-lg shadow-electric/10'
                  : 'bg-slate-50/80 text-slate-500 hover:bg-slate-100/80 hover:shadow-sm'
              }`}
            >
              {/* Gradient border for selected */}
              <div className={`absolute inset-0 rounded-2xl transition-opacity duration-300 ${
                theme === t.key ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-electric via-blue-500 to-cyan-400 p-[2px]">
                  <div className="h-full w-full rounded-[14px] bg-gradient-to-b from-white to-blue-50/50" />
                </div>
              </div>
              {/* Inactive border */}
              <div className={`absolute inset-0 rounded-2xl border-2 transition-opacity duration-300 ${
                theme === t.key ? 'opacity-0' : 'opacity-100 border-slate-200/80 group-hover:border-slate-300'
              }`} />

              <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                theme === t.key
                  ? 'bg-gradient-to-br from-electric to-cyan-400 text-white shadow-lg shadow-electric/25 scale-110'
                  : 'bg-white text-slate-400 shadow-sm group-hover:shadow-md group-hover:text-slate-500'
              }`}>
                <t.icon className="h-5 w-5" />
              </div>
              <div className="relative z-10">
                <p className={`text-sm font-bold transition-colors duration-200 ${theme === t.key ? 'text-electric' : 'text-slate-600'}`}>{t.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{t.desc}</p>
              </div>
              {/* Checkmark */}
              {theme === t.key && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2.5 right-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-electric to-cyan-400 shadow-sm"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-white" />
                </motion.div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl bg-white p-8 shadow-card border border-slate-200/60">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-100">
            <Bell className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-dark-text tracking-tight">Notifications</h2>
            <p className="text-sm text-slate-400">Configure how you want to be notified.</p>
          </div>
        </div>
        <div className="space-y-1">
          <Toggle
            label="Email notifications"
            description="Receive email updates for case status changes"
            checked={emailNotifs}
            onChange={(v) => { setEmailNotifs(v); localStorage.setItem('df-email-notifs', String(v)); }}
          />
          <div className="border-t border-slate-100 my-1" />
          <Toggle
            label="Push notifications"
            description="Browser push notifications for real-time alerts"
            checked={pushNotifs}
            onChange={togglePush}
          />
          {pushStatus && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-medium text-amber-600 ml-1 mt-2 flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              {pushStatus}
            </motion.p>
          )}
        </div>
      </div>
      {/* Support */}
      <div className="rounded-2xl bg-white p-8 shadow-card border border-slate-200/60">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-dark-text tracking-tight">Need Help?</h2>
            <p className="text-sm text-slate-400">Contact our support team</p>
          </div>
        </div>
        <a
          href={`mailto:${APP_SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200/60 px-5 py-3 text-sm font-medium text-dark-text hover:bg-slate-100 hover:border-slate-300 transition-all duration-200"
        >
          <Mail className="h-4 w-4 text-slate-500" />
          {APP_SUPPORT_EMAIL}
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </a>
      </div>
    </div>
  );
}

/* -- Shared helpers -- */

function Field({
  label, value, onChange, type = 'text', disabled = false, placeholder,
}: {
  label: string; value: string; onChange?: (v: string) => void; type?: string; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`h-11 w-full rounded-xl border px-4 text-sm text-dark-text transition-all duration-200 focus:outline-none ${
          disabled
            ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
            : 'bg-white border-slate-200/80 hover:border-slate-300 focus:border-electric focus:ring-4 focus:ring-electric/10 focus:shadow-sm'
        }`}
      />
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200/80 bg-white px-4 text-sm text-dark-text transition-all duration-200 hover:border-slate-300 focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/10 focus:shadow-sm appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || 'Select...'}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({
  label, description, checked, onChange,
}: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-1 rounded-xl hover:bg-slate-50/50 transition-colors duration-200">
      <div>
        <p className="text-sm font-bold text-dark-text">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition-all duration-300 shrink-0 ml-4 ${
          checked
            ? 'bg-gradient-to-r from-electric to-cyan-400 shadow-md shadow-electric/20'
            : 'bg-slate-200 hover:bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-300 ${
            checked ? 'translate-x-5 shadow-md' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
