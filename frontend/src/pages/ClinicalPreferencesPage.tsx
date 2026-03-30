// ClinicalPreferencesPage.tsx — 17 clinical preference settings matching ClearPath.

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { ApiResponse } from '@/types/common';

interface Prefs {
  tooth_numbering_system: string;
  tooth_size_discrepancy: string | null;
  default_ipr_preference: string | null;
  ipr_limit_per_contact: number;
  arch_expansion: string | null;
  default_proclination: string | null;
  default_extraction: string | null;
  occlusal_contacts: string | null;
  attachment_schedule: string | null;
  extraction_schedule: string | null;
  movement_velocity: string;
  pontics_for_open_spaces: string | null;
  virtual_power_chain: string | null;
  passive_aligners_default: string | null;
  terminal_molar_distortion: string | null;
  overcorrection: string | null;
  default_midline: string | null;
}

const DEFAULT_PREFS: Prefs = {
  tooth_numbering_system: 'FDI',
  tooth_size_discrepancy: null,
  default_ipr_preference: null,
  ipr_limit_per_contact: 0.5,
  arch_expansion: null,
  default_proclination: null,
  default_extraction: null,
  occlusal_contacts: null,
  attachment_schedule: null,
  extraction_schedule: null,
  movement_velocity: 'STANDARD',
  pontics_for_open_spaces: null,
  virtual_power_chain: null,
  passive_aligners_default: null,
  terminal_molar_distortion: null,
  overcorrection: null,
  default_midline: null,
};

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };

/* ------------------------------------------------------------------ */
/*  Reusable setting components                                        */
/* ------------------------------------------------------------------ */

function SettingCard({ num, title, desc, children }: {
  num: number; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-200/60 shadow-card p-5 hover:shadow-card-hover transition-shadow duration-300">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-electric/10 text-xs font-bold text-electric">
          {num}
        </span>
        <div>
          <h3 className="text-sm font-bold text-dark-text">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function RadioGroup({ value, onChange, options }: {
  value: string | null; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
            value === opt.value
              ? 'border-electric bg-electric/10 text-electric ring-1 ring-electric/20'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SelectSetting({ value, onChange, options }: {
  value: string | null; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
    >
      <option value="">Not set</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function ClinicalPreferencesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clinical-preferences'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Prefs>>('/clinical-preferences');
      return res.data.data!;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (prefs: Prefs) => {
      const res = await api.put<ApiResponse<Prefs>>('/clinical-preferences', prefs);
      return res.data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-preferences'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const set = (key: keyof Prefs, val: string | number) => setForm((p) => ({ ...p, [key]: val }));

  const LAB_OPTIONS = [
    { value: 'ALLOW', label: 'Allow' },
    { value: 'AVOID', label: 'Avoid' },
    { value: 'LAB_RECOMMEND', label: 'Lab to Recommend' },
  ];

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="h-5 w-5 text-slate-400" />
            <h1 className="text-2xl font-bold text-dark-text tracking-tight">Clinical Preferences</h1>
          </div>
          <p className="text-sm text-slate-500">Your defaults — automatically applied to every new case</p>
        </div>
        <Button variant="gradient" onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>
          {saved ? <><CheckCircle className="mr-1.5 h-4 w-4" /> Saved</> : 'Save All'}
        </Button>
      </motion.div>

      {/* 17 Settings */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingCard num={1} title="Tooth Numbering System" desc="How tooth numbers are displayed throughout the app">
          <RadioGroup value={form.tooth_numbering_system} onChange={(v) => set('tooth_numbering_system', v)} options={[
            { value: 'FDI', label: 'FDI (11-48)' },
            { value: 'UNIVERSAL', label: 'Universal (1-32)' },
            { value: 'PALMER', label: 'Palmer (┘└┐┌)' },
          ]} />
        </SettingCard>

        <SettingCard num={2} title="Tooth Size Discrepancy" desc="How to handle Bolton discrepancy">
          <RadioGroup value={form.tooth_size_discrepancy} onChange={(v) => set('tooth_size_discrepancy', v)} options={[
            { value: 'MAINTAIN', label: 'Maintain' },
            { value: 'CORRECT_WITH_IPR', label: 'Correct with IPR' },
            { value: 'CORRECT_WITH_COMPOSITE', label: 'Correct with Composite' },
          ]} />
        </SettingCard>

        <SettingCard num={3} title="IPR Preference" desc="Default interproximal reduction approach">
          <RadioGroup value={form.default_ipr_preference} onChange={(v) => set('default_ipr_preference', v)} options={[
            { value: 'PREFER_IPR', label: 'Prefer IPR' },
            { value: 'MINIMIZE_IPR', label: 'Minimize IPR' },
            { value: 'NO_IPR', label: 'No IPR' },
            { value: 'LAB_RECOMMEND', label: 'Lab Recommend' },
          ]} />
        </SettingCard>

        <SettingCard num={4} title="IPR Limits Per Contact" desc="Maximum IPR amount between two teeth">
          <div className="flex items-center gap-3">
            <input type="range" min={0.1} max={0.8} step={0.1} value={form.ipr_limit_per_contact}
              onChange={(e) => set('ipr_limit_per_contact', parseFloat(e.target.value))}
              className="flex-1 accent-electric" />
            <span className="text-sm font-bold text-electric w-12 text-center">{form.ipr_limit_per_contact.toFixed(1)}mm</span>
          </div>
        </SettingCard>

        <SettingCard num={5} title="Arch Expansion" desc="Default arch expansion preference">
          <RadioGroup value={form.arch_expansion} onChange={(v) => set('arch_expansion', v)} options={LAB_OPTIONS} />
        </SettingCard>

        <SettingCard num={6} title="Proclination" desc="Default proclination preference">
          <RadioGroup value={form.default_proclination} onChange={(v) => set('default_proclination', v)} options={LAB_OPTIONS} />
        </SettingCard>

        <SettingCard num={7} title="Extraction" desc="Default extraction preference">
          <RadioGroup value={form.default_extraction} onChange={(v) => set('default_extraction', v)} options={LAB_OPTIONS} />
        </SettingCard>

        <SettingCard num={8} title="Occlusal Contacts" desc="How to handle occlusal interferences">
          <SelectSetting value={form.occlusal_contacts} onChange={(v) => set('occlusal_contacts', v)} options={[
            { value: 'MAINTAIN_CURRENT', label: 'Maintain Current' },
            { value: 'IDEAL_CLASS_I', label: 'Ideal Class I' },
            { value: 'BEST_FIT', label: 'Best Fit' },
          ]} />
        </SettingCard>

        <SettingCard num={9} title="Attachment Schedule" desc="When to place attachments">
          <SelectSetting value={form.attachment_schedule} onChange={(v) => set('attachment_schedule', v)} options={[
            { value: 'FROM_STEP_1', label: 'From Step 1' },
            { value: 'FROM_STEP_2', label: 'From Step 2 onwards' },
            { value: 'DELAYED', label: 'Delayed start' },
            { value: 'LAB_RECOMMEND', label: 'Lab to Recommend' },
          ]} />
        </SettingCard>

        <SettingCard num={10} title="Extraction Schedule" desc="When to schedule extractions">
          <SelectSetting value={form.extraction_schedule} onChange={(v) => set('extraction_schedule', v)} options={[
            { value: 'BEFORE_TREATMENT', label: 'Before Treatment' },
            { value: 'DURING_TREATMENT', label: 'During Treatment' },
            { value: 'LAB_RECOMMEND', label: 'Lab to Recommend' },
          ]} />
        </SettingCard>

        <SettingCard num={11} title="Movement Velocity" desc="Speed of tooth movement per aligner">
          <RadioGroup value={form.movement_velocity} onChange={(v) => set('movement_velocity', v)} options={[
            { value: 'SLOW', label: 'Slow (0.15mm)' },
            { value: 'STANDARD', label: 'Standard (0.25mm)' },
            { value: 'FAST', label: 'Fast (0.35mm)' },
          ]} />
        </SettingCard>

        <SettingCard num={12} title="Pontics for Open Spaces" desc="How to handle missing tooth spaces">
          <RadioGroup value={form.pontics_for_open_spaces} onChange={(v) => set('pontics_for_open_spaces', v)} options={[
            { value: 'ADD_PONTIC', label: 'Add Pontic' },
            { value: 'CLOSE_SPACE', label: 'Close Space' },
            { value: 'MAINTAIN_SPACE', label: 'Maintain Space' },
          ]} />
        </SettingCard>

        <SettingCard num={13} title="Virtual Power Chain" desc="Simulated power chain effect">
          <RadioGroup value={form.virtual_power_chain} onChange={(v) => set('virtual_power_chain', v)} options={[
            { value: 'NO_VPC', label: 'No VPC' },
            { value: 'ANTERIOR', label: 'Anterior Only' },
            { value: 'POSTERIOR', label: 'Posterior Only' },
            { value: 'BOTH', label: 'Both Arches' },
          ]} />
        </SettingCard>

        <SettingCard num={14} title="Passive Aligners" desc="Include passive aligners at end of treatment">
          <RadioGroup value={form.passive_aligners_default} onChange={(v) => set('passive_aligners_default', v)} options={[
            { value: 'ADD_PASSIVE', label: 'Add 2 Passive' },
            { value: 'NO_PASSIVE', label: 'No Passive' },
            { value: 'LAB_RECOMMEND', label: 'Lab Recommend' },
          ]} />
        </SettingCard>

        <SettingCard num={15} title="Terminal Molar Distortion" desc="How to address terminal molar distortion">
          <SelectSetting value={form.terminal_molar_distortion} onChange={(v) => set('terminal_molar_distortion', v)} options={[
            { value: 'ACCEPT', label: 'Accept distortion' },
            { value: 'TRIM_ALIGNER', label: 'Trim aligner short' },
            { value: 'CUTOUT', label: 'Use cutout' },
            { value: 'LAB_RECOMMEND', label: 'Lab to Recommend' },
          ]} />
        </SettingCard>

        <SettingCard num={16} title="Overcorrection" desc="Apply overcorrection for predictable results">
          <RadioGroup value={form.overcorrection} onChange={(v) => set('overcorrection', v)} options={[
            { value: 'ROTATIONS_ONLY', label: 'Rotations Only' },
            { value: 'BL_MOVEMENTS', label: 'B/L Movements' },
            { value: 'BOTH', label: 'Both' },
            { value: 'NONE', label: 'None' },
          ]} />
        </SettingCard>

        <SettingCard num={17} title="Default Midline" desc="Default midline instruction for new cases">
          <SelectSetting value={form.default_midline} onChange={(v) => set('default_midline', v)} options={[
            { value: 'IMPROVE', label: 'Improve' },
            { value: 'MAINTAIN', label: 'Maintain' },
          ]} />
        </SettingCard>
      </div>

      {/* Bottom save */}
      <motion.div variants={fadeUp} className="flex justify-end pt-2 pb-8">
        <Button variant="gradient" onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending} className="px-8">
          {saved ? <><CheckCircle className="mr-1.5 h-4 w-4" /> Preferences Saved</> : 'Save All Preferences'}
        </Button>
      </motion.div>
    </motion.div>
  );
}
