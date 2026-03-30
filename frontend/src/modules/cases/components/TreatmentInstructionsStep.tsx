// TreatmentInstructionsStep.tsx — Step 2 of case wizard: occlusion, preferences, tooth chart.

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TreatmentInstructions {
  midline_instruction: string;
  overjet_instruction: string;
  overbite_instruction: string;
  crossbite_instruction: string;
  right_canine_class: string;
  left_canine_class: string;
  right_molar_class: string;
  left_molar_class: string;
  ipr_preference: string;
  proclination_preference: string;
  expansion_preference: string;
  extraction_preference: string;
  ipr_prescription: string;
  auxiliary_type: string;
}

interface TreatmentInstructionsStepProps {
  values: TreatmentInstructions;
  onChange: (field: keyof TreatmentInstructions, value: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Option cards                                                       */
/* ------------------------------------------------------------------ */

function ToggleCard({ label, selected, onSelect }: {
  label: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200',
        selected
          ? 'border-electric bg-electric/10 text-electric ring-1 ring-electric/20'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300',
      )}
    >
      {label}
    </button>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-slate-600 uppercase tracking-wider">{title}</label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function TriChoice({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3">
      <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <ToggleCard
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onSelect={() => onChange(opt.value)}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function TreatmentInstructionsStep({ values, onChange }: TreatmentInstructionsStepProps) {
  const LAB_RECOMMEND_OPTIONS = [
    { value: 'ALLOW', label: 'Allow' },
    { value: 'AVOID', label: 'Avoid' },
    { value: 'LAB_RECOMMEND', label: 'Lab to Recommend' },
  ];

  return (
    <div className="space-y-6">
      {/* Section 1: Occlusion */}
      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold text-dark-text">Occlusion & Bite</h3>
          <p className="text-xs text-slate-400 mt-0.5">Set your treatment goals for bite correction</p>
        </div>
        <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Midline */}
          <div className="sm:col-span-2">
            <label className="mb-2 block text-xs font-semibold text-slate-600">Midline</label>
            <select
              value={values.midline_instruction}
              onChange={(e) => onChange('midline_instruction', e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
            >
              <option value="">Select...</option>
              <option value="IMPROVE">Improve</option>
              <option value="MAINTAIN">Maintain</option>
              <option value="MOVE_UPPER_LEFT">Move Upper to Left</option>
              <option value="MOVE_UPPER_RIGHT">Move Upper to Right</option>
              <option value="MOVE_LOWER_LEFT">Move Lower to Left</option>
              <option value="MOVE_LOWER_RIGHT">Move Lower to Right</option>
              <option value="MOVE_BOTH">Move Both</option>
            </select>
          </div>

          {/* Overjet */}
          <FieldGroup title="Overjet">
            <ToggleCard label="Improve" selected={values.overjet_instruction === 'IMPROVE'} onSelect={() => onChange('overjet_instruction', 'IMPROVE')} />
            <ToggleCard label="Maintain" selected={values.overjet_instruction === 'MAINTAIN'} onSelect={() => onChange('overjet_instruction', 'MAINTAIN')} />
          </FieldGroup>

          {/* Overbite */}
          <FieldGroup title="Overbite">
            <ToggleCard label="Improve" selected={values.overbite_instruction === 'IMPROVE'} onSelect={() => onChange('overbite_instruction', 'IMPROVE')} />
            <ToggleCard label="Maintain" selected={values.overbite_instruction === 'MAINTAIN'} onSelect={() => onChange('overbite_instruction', 'MAINTAIN')} />
          </FieldGroup>

          {/* Cross Bite */}
          <FieldGroup title="Cross Bite">
            <ToggleCard label="Correct" selected={values.crossbite_instruction === 'CORRECT'} onSelect={() => onChange('crossbite_instruction', 'CORRECT')} />
            <ToggleCard label="Maintain" selected={values.crossbite_instruction === 'MAINTAIN'} onSelect={() => onChange('crossbite_instruction', 'MAINTAIN')} />
          </FieldGroup>

          {/* Canine Classes */}
          <FieldGroup title="Right Canine">
            {['I', 'II', 'III'].map((c) => (
              <ToggleCard key={c} label={`Class ${c}`} selected={values.right_canine_class === c} onSelect={() => onChange('right_canine_class', c)} />
            ))}
          </FieldGroup>
          <FieldGroup title="Left Canine">
            {['I', 'II', 'III'].map((c) => (
              <ToggleCard key={c} label={`Class ${c}`} selected={values.left_canine_class === c} onSelect={() => onChange('left_canine_class', c)} />
            ))}
          </FieldGroup>

          {/* Molar Classes */}
          <FieldGroup title="Right Molar">
            {['I', 'II', 'III'].map((c) => (
              <ToggleCard key={c} label={`Class ${c}`} selected={values.right_molar_class === c} onSelect={() => onChange('right_molar_class', c)} />
            ))}
          </FieldGroup>
          <FieldGroup title="Left Molar">
            {['I', 'II', 'III'].map((c) => (
              <ToggleCard key={c} label={`Class ${c}`} selected={values.left_molar_class === c} onSelect={() => onChange('left_molar_class', c)} />
            ))}
          </FieldGroup>
        </div>
      </div>

      {/* Section 2: Treatment Preferences */}
      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold text-dark-text">Treatment Preferences</h3>
          <p className="text-xs text-slate-400 mt-0.5">Set your preferences for IPR, expansion, and movements</p>
        </div>
        <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TriChoice label="Proclination" value={values.proclination_preference} onChange={(v) => onChange('proclination_preference', v)} options={LAB_RECOMMEND_OPTIONS} />
          <TriChoice label="Expansion" value={values.expansion_preference} onChange={(v) => onChange('expansion_preference', v)} options={LAB_RECOMMEND_OPTIONS} />
          <TriChoice label="Extraction" value={values.extraction_preference} onChange={(v) => onChange('extraction_preference', v)} options={LAB_RECOMMEND_OPTIONS} />

          {/* IPR Prescription */}
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">IPR Prescription</p>
            <select
              value={values.ipr_prescription}
              onChange={(e) => onChange('ipr_prescription', e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-electric focus:outline-none"
            >
              <option value="">Select...</option>
              <option value="AS_NEEDED">As Needed</option>
              <option value="ANTERIOR_ONLY">Anterior Only</option>
              <option value="POSTERIOR_ONLY">Posterior Only</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          {/* Auxiliary Type */}
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Auxiliary Type</p>
            <select
              value={values.auxiliary_type}
              onChange={(e) => onChange('auxiliary_type', e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-electric focus:outline-none"
            >
              <option value="">None</option>
              <option value="BUTTONS">Buttons</option>
              <option value="ELASTICS">Elastics</option>
              <option value="POWER_RIDGES">Power Ridges</option>
            </select>
          </div>

          {/* IPR Preference */}
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">IPR Preference</p>
            <select
              value={values.ipr_preference}
              onChange={(e) => onChange('ipr_preference', e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-electric focus:outline-none"
            >
              <option value="">Select...</option>
              <option value="PREFER_IPR">Prefer IPR</option>
              <option value="MINIMIZE_IPR">Minimize IPR</option>
              <option value="NO_IPR">No IPR</option>
              <option value="LAB_RECOMMEND">Lab to Recommend</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
