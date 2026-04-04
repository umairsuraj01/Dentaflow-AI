// NewCasePage.tsx — 4-step new case wizard with patient, details, files + instructions, review.

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Search, UserPlus,
  Smile, ArrowUpFromLine, ArrowDownFromLine, Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ROUTES, PRICING, TURNAROUND } from '@/constants';
import api from '@/lib/api';
import type { ApiResponse } from '@/types/common';
import { cn } from '@/lib/utils';
import { usePatients } from '@/modules/patients/hooks/usePatients';
import { useCases } from '../hooks/useCases';
import { useFileUpload } from '../hooks/useFileUpload';
import { FileUploadZone } from '../components/FileUploadZone';
import { ToothInstructionPanel } from '@/modules/tooth-instructions/components/ToothInstructionPanel';
import { useToothInstructions } from '@/modules/tooth-instructions/hooks/useToothInstructions';
import type { CasePriority, TreatmentType } from '../types/case.types';
import type { Patient, PatientCreateRequest } from '@/modules/patients/types/patient.types';
import type { ToothInstructionCreate } from '@/modules/tooth-instructions/types/tooth-instruction.types';

const STEPS = ['Patient', 'Details', 'Files & Instructions', 'Review'];

const TREATMENT_OPTIONS: { value: TreatmentType; label: string; icon: React.ElementType }[] = [
  { value: 'FULL_ARCH', label: 'Full Arch', icon: Maximize2 },
  { value: 'UPPER_ONLY', label: 'Upper Only', icon: ArrowUpFromLine },
  { value: 'LOWER_ONLY', label: 'Lower Only', icon: ArrowDownFromLine },
  { value: 'BOTH_ARCHES', label: 'Both Arches', icon: Smile },
];

const PRIORITY_OPTIONS: { value: CasePriority; label: string; price: number; days: number }[] = [
  { value: 'NORMAL', label: 'Normal', price: PRICING.normal, days: TURNAROUND.normal },
  { value: 'URGENT', label: 'Urgent', price: PRICING.urgent, days: TURNAROUND.urgent },
  { value: 'RUSH', label: 'Rush', price: PRICING.rush, days: TURNAROUND.rush },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

export function NewCasePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Step 1 state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState<PatientCreateRequest>({ first_name: '', last_name: '' });
  const { patients, isLoading: _patientsLoading, createPatient } = usePatients(patientSearch);

  // Step 2 state
  const [treatmentType, setTreatmentType] = useState<TreatmentType>('FULL_ARCH');
  const [priority, setPriority] = useState<CasePriority>('NORMAL');
  const [complaint, setComplaint] = useState('');
  const [goals, setGoals] = useState('');
  const [specialInst, _setSpecialInst] = useState('');
  const [patientType, _setPatientType] = useState('ADULT');
  const [retainerPref, _setRetainerPref] = useState('');
  const [passiveAligners, _setPassiveAligners] = useState('');
  const [alignerShipment, _setAlignerShipment] = useState('ALL_AT_ONCE');
  const [rescanAfterIpr, _setRescanAfterIpr] = useState(false);

  // Fetch clinical preferences to auto-populate
  const { data: clinicalPrefs } = useQuery({
    queryKey: ['clinical-preferences'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Record<string, string | number | null>>>('/clinical-preferences');
      return res.data.data;
    },
  });

  // Treatment instructions state
  const [txInstructions, setTxInstructions] = useState({
    midline_instruction: '', overjet_instruction: '', overbite_instruction: '',
    crossbite_instruction: '', right_canine_class: '', left_canine_class: '',
    right_molar_class: '', left_molar_class: '', ipr_preference: '',
    proclination_preference: '', expansion_preference: '', extraction_preference: '',
    ipr_prescription: '', auxiliary_type: '',
  });
  // Auto-populate from clinical preferences when loaded
  useEffect(() => {
    if (clinicalPrefs) {
      setTxInstructions((prev) => ({
        ...prev,
        midline_instruction: (clinicalPrefs.default_midline as string) || prev.midline_instruction,
        proclination_preference: (clinicalPrefs.default_proclination as string) || prev.proclination_preference,
        expansion_preference: (clinicalPrefs.arch_expansion as string) || prev.expansion_preference,
        extraction_preference: (clinicalPrefs.default_extraction as string) || prev.extraction_preference,
        ipr_preference: (clinicalPrefs.default_ipr_preference as string) || prev.ipr_preference,
      }));
    }
  }, [clinicalPrefs]);

  // Step 3 state
  const [caseId, _setCaseId] = useState<string | undefined>();
  const { uploads, uploadFile, removeUpload } = useFileUpload(caseId);
  const { instructions, addInstruction, removeInstruction } = useToothInstructions({});

  // Create & submit
  const { createCase, submitCase, isCreating } = useCases();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = () => { setDirection(1); setStep((s) => Math.min(s + 1, 3)); };
  const prev = () => { setDirection(-1); setStep((s) => Math.max(s - 1, 0)); };

  const handleCreatePatient = useCallback(async () => {
    const patient = await createPatient(newPatient);
    setSelectedPatient(patient);
    setShowNewPatient(false);
  }, [createPatient, newPatient]);

  const handleSubmit = useCallback(async () => {
    if (!selectedPatient) return;
    setIsSubmitting(true);
    try {
      const c = await createCase({
        patient_id: selectedPatient.id,
        treatment_type: treatmentType,
        priority,
        chief_complaint: complaint || undefined,
        treatment_goals: goals || undefined,
        special_instructions: specialInst || undefined,
        patient_type: patientType || undefined,
        retainer_preference: retainerPref || undefined,
        passive_aligners: passiveAligners || undefined,
        aligner_shipment: alignerShipment || undefined,
        rescan_after_ipr: rescanAfterIpr,
        ...Object.fromEntries(
          Object.entries(txInstructions).filter(([_, v]) => v)
        ),
      });
      await submitCase(c.id);
      navigate(ROUTES.CASE_DETAIL(c.id));
    } catch { /* errors handled by mutation */ }
    finally { setIsSubmitting(false); }
  }, [selectedPatient, treatmentType, priority, complaint, goals, specialInst, createCase, submitCase, navigate]);

  const selectedPricing = PRIORITY_OPTIONS.find((p) => p.value === priority)!;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-dark-text">New Case</h1>

      {/* Progress stepper */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              i <= step ? 'bg-electric text-white' : 'bg-gray-200 text-gray-500',
            )}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className="hidden text-xs text-gray-500 sm:block">{label}</span>
            {i < STEPS.length - 1 && (
              <div className={cn('h-0.5 flex-1 rounded', i < step ? 'bg-electric' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        {/* Step 1: Patient */}
        {step === 0 && (
          <motion.div key="s0" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-dark-text">Select or Create Patient</h2>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" placeholder="Search patients..."
                  value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm focus:border-electric focus:outline-none"
                />
              </div>
              {selectedPatient && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border-2 border-electric bg-blue-50 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-electric text-sm font-bold text-white">
                    {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-dark-text">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.date_of_birth || 'No DOB'}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedPatient(null)}>Change</Button>
                </div>
              )}
              {!selectedPatient && (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPatient(p)}
                      className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-soft-gray"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold">
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <span className="text-sm">{p.first_name} {p.last_name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowNewPatient(true)}
                    className="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 p-2.5 text-sm text-electric hover:bg-blue-50"
                  >
                    <UserPlus className="h-4 w-4" /> Create New Patient
                  </button>
                </div>
              )}
              {showNewPatient && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-soft-gray/50 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="First Name" value={newPatient.first_name} onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })} />
                    <Input label="Last Name" value={newPatient.last_name} onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })} />
                  </div>
                  <Input label="Date of Birth" type="date" value={newPatient.date_of_birth || ''} onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreatePatient}>Create</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewPatient(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
            <div className="mt-6 flex justify-end">
              <Button onClick={next} disabled={!selectedPatient}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Case Details */}
        {step === 1 && (
          <motion.div key="s1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-dark-text">Treatment Type</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {TREATMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTreatmentType(opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                        treatmentType === opt.value ? 'border-electric bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <opt.icon className={cn('h-8 w-8', treatmentType === opt.value ? 'text-electric' : 'text-gray-400')} />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-dark-text">Priority</h3>
                <div className="grid grid-cols-3 gap-3">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPriority(opt.value)}
                      className={cn(
                        'rounded-xl border-2 p-4 text-center transition-all',
                        priority === opt.value ? 'border-electric bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="mt-1 text-lg font-bold text-electric">${opt.price}</p>
                      <p className="text-xs text-gray-500">{opt.days === 0 ? 'Same day' : `${opt.days} day${opt.days > 1 ? 's' : ''}`}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark-text">Chief Complaint</label>
                <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-electric focus:outline-none" placeholder="Describe the patient's primary concern..." />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark-text">Treatment Goals</label>
                <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-electric focus:outline-none" placeholder="What outcomes are you looking for..." />
              </div>
            </Card>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={prev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={next}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Files + Instructions */}
        {step === 2 && (
          <motion.div key="s2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-dark-text">Upload Scan Files</h3>
                <FileUploadZone
                  onFilesSelected={(files, ft) => files.forEach((f) => uploadFile(f, ft))}
                  uploads={uploads}
                  onRemove={removeUpload}
                  fileType="UPPER_SCAN"
                  label="Drop STL, OBJ, or PLY files here"
                />
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-dark-text">Tooth Instructions</h3>
                <p className="mb-3 text-xs text-gray-500">Click on any tooth to add clinical instructions for the technician and AI pipeline.</p>
                <ToothInstructionPanel
                  instructions={instructions as ToothInstructionCreate[]}
                  onAdd={(data) => addInstruction(data)}
                  onRemove={(idOrIndex) => removeInstruction(idOrIndex)}
                />
              </div>
            </Card>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={prev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={next}>Review <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 3 && (
          <motion.div key="s3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="mb-3 text-sm font-semibold text-dark-text">Patient</h3>
                <p className="text-sm">{selectedPatient?.first_name} {selectedPatient?.last_name}</p>
              </Card>
              <Card className="p-6">
                <h3 className="mb-3 text-sm font-semibold text-dark-text">Case Details</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-gray-500">Treatment:</span>
                  <span>{treatmentType.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500">Priority:</span>
                  <span>{priority}</span>
                  <span className="text-gray-500">Estimated Cost:</span>
                  <span className="font-semibold text-electric">${selectedPricing.price.toFixed(2)}</span>
                  <span className="text-gray-500">Turnaround:</span>
                  <span>{selectedPricing.days === 0 ? 'Same day' : `${selectedPricing.days} day(s)`}</span>
                </div>
              </Card>
              <Card className="p-6">
                <h3 className="mb-3 text-sm font-semibold text-dark-text">Files ({uploads.filter((u) => u.status === 'done').length})</h3>
                {uploads.filter((u) => u.status === 'done').map((u, i) => (
                  <p key={i} className="text-sm text-gray-600">{u.file.name}</p>
                ))}
                {uploads.filter((u) => u.status === 'done').length === 0 && (
                  <p className="text-sm text-gray-400">No files uploaded yet</p>
                )}
              </Card>
              <Card className="p-6">
                <h3 className="mb-3 text-sm font-semibold text-dark-text">Tooth Instructions ({instructions.length})</h3>
                {instructions.length > 0 ? (
                  <p className="text-sm text-gray-600">{instructions.length} instruction(s) added</p>
                ) : (
                  <p className="text-sm text-gray-400">No instructions added</p>
                )}
              </Card>
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={prev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={handleSubmit} loading={isSubmitting || isCreating}>Submit Case</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
