// WorkflowSidebar.tsx — Vertical step navigation for treatment workflow.

import {
  Brain, Eye, Activity, Crosshair, Layers,
  FileText, Wrench, Printer, ChevronRight, Check, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkflowStep =
  | 'segment'
  | 'review'
  | 'analysis'
  | 'setup'
  | 'staging'
  | 'summary'
  | 'advanced'
  | 'export';

interface StepDef {
  key: WorkflowStep;
  icon: React.ElementType;
  label: string;
  description: string;
  group: 'prepare' | 'plan' | 'finalize';
}

const STEPS: StepDef[] = [
  { key: 'segment',  icon: Brain,     label: 'AI Segmentation',  description: 'Detect & segment teeth',       group: 'prepare' },
  { key: 'review',   icon: Eye,       label: 'Review & Edit',    description: 'Refine AI segmentation',       group: 'prepare' },
  { key: 'analysis', icon: Activity,  label: 'Dental Analysis',  description: 'Space, arch, Bolton analysis', group: 'plan' },
  { key: 'setup',    icon: Crosshair, label: 'Set Targets',      description: 'Position teeth for treatment', group: 'plan' },
  { key: 'staging',  icon: Layers,    label: 'Smart Staging',    description: 'Auto-compute aligner stages',  group: 'plan' },
  { key: 'summary',  icon: FileText,  label: 'Clinical Summary', description: 'Review treatment report',      group: 'finalize' },
  { key: 'advanced', icon: Wrench,    label: 'Advanced Tools',   description: 'Trim, base, gingiva, etc.',    group: 'finalize' },
  { key: 'export',   icon: Printer,   label: 'Export & Print',   description: 'Validate & export for print',  group: 'finalize' },
];

const GROUP_LABELS: Record<string, string> = {
  prepare: 'Prepare',
  plan: 'Plan',
  finalize: 'Finalize',
};

interface Props {
  activeStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  unlockedSteps: Set<WorkflowStep>;
  onStepClick: (step: WorkflowStep) => void;
}

export function WorkflowSidebar({ activeStep, completedSteps, unlockedSteps, onStepClick }: Props) {
  let currentGroup = '';

  return (
    <div className="w-56 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-y-auto">
      {/* Logo area */}
      <div className="px-4 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-dark-text">Treatment Planner</h2>
        <p className="text-[10px] text-gray-400 mt-0.5">Follow each step below</p>
      </div>

      {/* Steps */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {STEPS.map((step, _idx) => {
          const isActive = activeStep === step.key;
          const isCompleted = completedSteps.has(step.key);
          const isUnlocked = unlockedSteps.has(step.key);
          const isLocked = !isUnlocked && !isCompleted;

          // Group header
          let groupHeader: React.ReactNode = null;
          if (step.group !== currentGroup) {
            currentGroup = step.group;
            groupHeader = (
              <div className="pt-3 pb-1 px-2 first:pt-0">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                  {GROUP_LABELS[step.group]}
                </span>
              </div>
            );
          }

          return (
            <div key={step.key}>
              {groupHeader}
              <button
                onClick={() => !isLocked && onStepClick(step.key)}
                disabled={isLocked}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all group',
                  isActive
                    ? 'bg-electric/10 text-electric border border-electric/20'
                    : isCompleted
                      ? 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      : isUnlocked
                        ? 'text-gray-600 hover:bg-gray-50 border border-transparent'
                        : 'text-gray-400 cursor-not-allowed border border-transparent opacity-50',
                )}
              >
                {/* Step indicator */}
                <div
                  className={cn(
                    'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                    isActive
                      ? 'bg-electric text-white'
                      : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isUnlocked
                          ? 'bg-gray-200 text-gray-500'
                          : 'bg-gray-100 text-gray-400',
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isLocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <step.icon className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    'text-xs font-medium truncate',
                    isActive && 'text-electric',
                  )}>
                    {step.label}
                  </div>
                  <div className="text-[9px] text-gray-400 truncate">
                    {step.description}
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <ChevronRight className="h-3.5 w-3.5 text-electric flex-shrink-0" />
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Progress footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
          <span>Progress</span>
          <span>{completedSteps.size}/{STEPS.length} steps</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-electric transition-all duration-500"
            style={{ width: `${(completedSteps.size / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
