export interface Patient {
  id: string;
  name: string;
  caseNumber: string;
  doctor?: string;
  phone?: string;
  createdAt: string;
}

export interface Aligner {
  id: string;
  patientId: string;
  patientName: string;
  caseNumber: string;
  stageNumber: string;
  totalPairs: number;
  arrivedPairs: number;
  status: 'pending' | 'stored' | 'handed_over' | 'returned' | 'damaged';
  shelfId?: string;
  cabinetNumber?: string;
  layerNumber?: string;
  cellNumber?: string;
  manufacturer: string;
  arrivedDate: string;
  storedDate?: string;
  remark?: string;
  hasDoctorInfo: boolean;
}

export interface Shelf {
  id: string;
  cabinetNumber: string;
  layerNumber: string;
  cellNumber: string;
  isOccupied: boolean;
  alignerId?: string;
}

export interface HandoverRecord {
  id: string;
  alignerId: string;
  patientName: string;
  caseNumber: string;
  receiver: string;
  receiverRole: string;
  pairsTaken: number;
  purpose: 'clinic_delivery' | 'chairside_check' | 'return' | 'reissue' | 'damage';
  handoverDate: string;
  remark?: string;
  operator: string;
}

export type HandoverPurpose = 'clinic_delivery' | 'chairside_check' | 'return' | 'reissue' | 'damage';

export interface DuplicatePatientCheck {
  exists: boolean;
  patients: Patient[];
}
