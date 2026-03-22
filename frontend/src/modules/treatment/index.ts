// treatment module barrel exports

export { TreatmentViewer } from './components/TreatmentViewer';
export { TimelinePlayer } from './components/TimelinePlayer';
export { ToothTransformPanel } from './components/ToothTransformPanel';
export { ToothMesh } from './components/ToothMesh';
export { useToothMeshes } from './hooks/useToothMeshes';
export { useAnimation } from './hooks/useAnimation';
export { treatmentService } from './services/treatment.service';
export { analysisService } from './services/analysis.service';
export { AnalysisPanel } from './components/AnalysisPanel';
export { StagingOptionsPanel } from './components/StagingOptionsPanel';
export { ClinicalSummaryPanel } from './components/ClinicalSummaryPanel';
export type * from './types/treatment.types';
export type * from './types/analysis.types';
