// modules/cases/index.ts — Public API of the cases module.

export type { Case, CaseFile, CaseNote, CaseCreateRequest, DashboardStats, CaseStatus, CasePriority, TreatmentType } from './types/case.types';
export { caseService } from './services/case.service';
export { useCases } from './hooks/useCases';
export { useCaseDetail } from './hooks/useCaseDetail';
export { useFileUpload } from './hooks/useFileUpload';
export { CaseStatusBadge } from './components/CaseStatusBadge';
export { CasePriorityBadge } from './components/CasePriorityBadge';
export { FileUploadZone } from './components/FileUploadZone';
export { CasesListPage } from './pages/CasesListPage';
export { NewCasePage } from './pages/NewCasePage';
export { CaseDetailPage } from './pages/CaseDetailPage';
export { AIProcessingPage } from './pages/AIProcessingPage';
