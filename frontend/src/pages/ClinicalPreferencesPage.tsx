// ClinicalPreferencesPage.tsx — Compact widget-style clinical preferences (defaults for all new cases).

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings2, CheckCircle, Info } from 'lucide-react';
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
  tooth_numbering_system: 'FDI', tooth_size_discrepancy: null, default_ipr_preference: null,
  ipr_limit_per_contact: 0.5, arch_expansion: null, default_proclination: null,
  default_extraction: null, occlusal_contacts: null, attachment_schedule: null,
  extraction_schedule: null, movement_velocity: 'STANDARD', pontics_for_open_spaces: null,
  virtual_power_chain: null, passive_aligners_default: null, terminal_molar_distortion: null,
  overcorrection: null, default_midline: null,
};

/* ------------------------------------------------------------------ */
/*  Compact widget helpers                                             */
/* ------------------------------------------------------------------ */

function PillGroup({ value, onChange, options }: {
  value: string | null; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md border px-2 py-1 text-[11px] font-medium transition-all',
            value === opt.value
              ? 'border-electric bg-electric text-white'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50',
          )}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Row({ num, label, children }: { num: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-electric/10 text-[10px] font-bold text-electric">{num}</span>
      <span className="text-xs font-semibold text-slate-700 w-40 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
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
    queryFn: async () => { const res = await api.get<ApiResponse<Prefs>>('/clinical-preferences'); return res.data.data!; },
  });

  useEffect(() => { if (data) setForm(data); }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (prefs: Prefs) => { const res = await api.put<ApiResponse<Prefs>>('/clinical-preferences', prefs); return res.data.data!; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clinical-preferences'] }); setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });

  const set = (key: keyof Prefs, val: string | number) => setForm((p) => ({ ...p, [key]: val }));

  const LAB = [{ value: 'ALLOW', label: 'Allow' }, { value: 'AVOID', label: 'Avoid' }, { value: 'LAB_RECOMMEND', label: 'Lab Recommend' }];

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="h-5 w-5 text-slate-400" />
            <h1 className="text-2xl font-bold text-dark-text tracking-tight">Clinical Preferences</h1>
          </div>
          <p className="text-sm text-slate-500">Your default settings for all new cases</p>
        </div>
        <Button variant="gradient" onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>
          {saved ? <><CheckCircle className="mr-1.5 h-4 w-4" /> Saved</> : 'Save All'}
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200/60 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          These are your <strong>default preferences</strong> — they auto-fill every new case you create.
          You can always <strong>override per patient</strong> during case submission.
        </p>
      </div>

      {/* Section 1: General */}
      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">General</h2>
        </div>
        <div className="px-5">
          <Row num={1} label="Default Midline">
            <PillGroup value={form.default_midline} onChange={(v) => set('default_midline', v)} options={[
              { value: 'IMPROVE', label: 'Improve' }, { value: 'MAINTAIN', label: 'Maintain' },
            ]} />
          </Row>
          <Row num={2} label="Tooth Numbering">
            <PillGroup value={form.tooth_numbering_system} onChange={(v) => set('tooth_numbering_system', v)} options={[
              { value: 'FDI', label: 'FDI (11-48)' }, { value: 'UNIVERSAL', label: 'Universal (1-32)' }, { value: 'PALMER', label: 'Palmer' },
            ]} />
          </Row>
          <Row num={3} label="Movement Velocity">
            <PillGroup value={form.movement_velocity} onChange={(v) => set('movement_velocity', v)} options={[
              { value: 'SLOW', label: 'Slow (0.15mm)' }, { value: 'STANDARD', label: 'Standard (0.25mm)' }, { value: 'FAST', label: 'Fast (0.35mm)' },
            ]} />
          </Row>
        </div>
      </div>

      {/* Section 2: IPR & Space Management */}
      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">IPR & Space Management</h2>
        </div>
        <div className="px-5">
          <Row num={4} label="IPR Preference">
            <PillGroup value={form.default_ipr_preference} onChange={(v) => set('default_ipr_preference', v)} options={[
              { value: 'PREFER_IPR', label: 'Prefer' }, { value: 'MINIMIZE_IPR', label: 'Minimize' },
              { value: 'NO_IPR', label: 'No IPR' }, { value: 'LAB_RECOMMEND', label: 'Lab Recommend' },
            ]} />
          </Row>
          <Row num={5} label="IPR Limit / Contact">
            <div className="flex items-center gap-3">
              <input type="range" min={0.1} max={0.8} step={0.1} value={form.ipr_limit_per_contact}
                onChange={(e) => set('ipr_limit_per_contact', parseFloat(e.target.value))}
                className="flex-1 accent-electric h-1.5" />
              <span className="text-xs font-bold text-electric w-10 text-center">{form.ipr_limit_per_contact.toFixed(1)}mm</span>
            </div>
          </Row>
          <Row num={6} label="Tooth Size Discrepancy">
            <PillGroup value={form.tooth_size_discrepancy} onChange={(v) => set('tooth_size_discrepancy', v)} options={[
              { value: 'MAINTAIN', label: 'Maintain' }, { value: 'CORRECT_WITH_IPR', label: 'Correct w/ IPR' }, { value: 'CORRECT_WITH_COMPOSITE', label: 'Composite' },
            ]} />
          </Row>
          <Row num={7} label="Pontics for Spaces">
            <PillGroup value={form.pontics_for_open_spaces} onChange={(v) => set('pontics_for_open_spaces', v)} options={[
              { value: 'ADD_PONTIC', label: 'Add Pontic' }, { value: 'CLOSE_SPACE', label: 'Close Space' }, { value: 'MAINTAIN_SPACE', label: 'Maintain' },
            ]} />
          </Row>
        </div>
      </div>

      {/* Section 3: Treatment Approach */}
      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Treatment Approach</h2>
        </div>
        <div className="px-5">
          <Row num={8} label="Proclination">
            <PillGroup value={form.default_proclination} onChange={(v) => set('default_proclination', v)} options={LAB} />
          </Row>
          <Row num={9} label="Arch Expansion">
            <PillGroup value={form.arch_expansion} onChange={(v) => set('arch_expansion', v)} options={LAB} />
          </Row>
          <Row num={10} label="Extraction">
            <PillGroup value={form.default_extraction} onChange={(v) => set('default_extraction', v)} options={LAB} />
          </Row>
          <Row num={11} label="Overcorrection">
            <PillGroup value={form.overcorrection} onChange={(v) => set('overcorrection', v)} options={[
              { value: 'ROTATIONS_ONLY', label: 'Rotations' }, { value: 'BL_MOVEMENTS', label: 'B/L Moves' },
              { value: 'BOTH', label: 'Both' }, { value: 'NONE', label: 'None' },
            ]} />
          </Row>
        </div>
      </div>

      {/* Section 4: Scheduling */}
      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Scheduling & Attachments</h2>
        </div>
        <div className="px-5">
          <Row num={12} label="Occlusal Contacts">
            <PillGroup value={form.occlusal_contacts} onChange={(v) => set('occlusal_contacts', v)} options={[
              { value: 'MAINTAIN_CURRENT', label: 'Maintain' }, { value: 'IDEAL_CLASS_I', label: 'Ideal Class I' }, { value: 'BEST_FIT', label: 'Best Fit' },
            ]} />
          </Row>
          <Row num={13} label="Attachment Schedule">
            <PillGroup value={form.attachment_schedule} onChange={(v) => set('attachment_schedule', v)} options={[
              { value: 'FROM_STEP_1', label: 'Step 1' }, { value: 'FROM_STEP_2', label: 'Step 2+' },
              { value: 'DELAYED', label: 'Delayed' }, { value: 'LAB_RECOMMEND', label: 'Lab Recommend' },
            ]} />
          </Row>
          <Row num={14} label="Extraction Schedule">
            <PillGroup value={form.extraction_schedule} onChange={(v) => set('extraction_schedule', v)} options={[
              { value: 'BEFORE_TREATMENT', label: 'Before' }, { value: 'DURING_TREATMENT', label: 'During' }, { value: 'LAB_RECOMMEND', label: 'Lab Recommend' },
            ]} />
          </Row>
        </div>
      </div>

      {/* Section 5: Advanced */}
      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Advanced</h2>
        </div>
        <div className="px-5">
          <Row num={15} label="Virtual Power Chain">
            <PillGroup value={form.virtual_power_chain} onChange={(v) => set('virtual_power_chain', v)} options={[
              { value: 'NO_VPC', label: 'No VPC' }, { value: 'ANTERIOR', label: 'Anterior' },
              { value: 'POSTERIOR', label: 'Posterior' }, { value: 'BOTH', label: 'Both' },
            ]} />
          </Row>
          <Row num={16} label="Passive Aligners">
            <PillGroup value={form.passive_aligners_default} onChange={(v) => set('passive_aligners_default', v)} options={[
              { value: 'ADD_PASSIVE', label: 'Add 2 Passive' }, { value: 'NO_PASSIVE', label: 'No Passive' }, { value: 'LAB_RECOMMEND', label: 'Lab Recommend' },
            ]} />
          </Row>
          <Row num={17} label="Terminal Molar">
            <PillGroup value={form.terminal_molar_distortion} onChange={(v) => set('terminal_molar_distortion', v)} options={[
              { value: 'ACCEPT', label: 'Accept' }, { value: 'TRIM_ALIGNER', label: 'Trim Short' },
              { value: 'CUTOUT', label: 'Cutout' }, { value: 'LAB_RECOMMEND', label: 'Lab Recommend' },
            ]} />
          </Row>
        </div>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <Button variant="gradient" onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending} className="px-8">
          {saved ? <><CheckCircle className="mr-1.5 h-4 w-4" /> Saved</> : 'Save All Preferences'}
        </Button>
      </div>
    </motion.div>
  );
}
