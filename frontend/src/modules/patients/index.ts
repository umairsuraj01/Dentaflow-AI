// modules/patients/index.ts — Public API of the patients module.

export type { Patient, PatientCreateRequest } from './types/patient.types';
export { patientService } from './services/patient.service';
export { usePatients } from './hooks/usePatients';
