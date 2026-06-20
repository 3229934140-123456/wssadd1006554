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
  needDoctorInfo?: boolean;
  isBatch?: boolean;
  batchId?: string;
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

export interface InventoryRecord {
  id: string;
  cabinetNumber: string;
  layerNumber: string;
  cellNumber: string;
  shelfId?: string;
  expectedAlignerId?: string;
  expectedPatientName?: string;
  expectedCaseNumber?: string;
  expectedStageNumber?: string;
  status: 'normal' | 'empty' | 'mismatch' | 'missing';
  actualAlignerId?: string;
  actualPatientName?: string;
  actualCaseNumber?: string;
  actualStageNumber?: string;
  remark?: string;
  inventoryBy: string;
  inventoryDate: string;
  inventoryBatchId: string;
}

export interface InventoryBatch {
  id: string;
  cabinetNumber: string;
  inventoryBy: string;
  inventoryDate: string;
  status: 'in_progress' | 'completed';
  totalCount: number;
  normalCount: number;
  emptyCount: number;
  mismatchCount: number;
  missingCount: number;
}

export interface BatchStockInItem {
  id: string;
  patientName: string;
  caseNumber: string;
  stageNumber: string;
  totalPairs: string;
  arrivedPairs: string;
  manufacturer: string;
  doctor: string;
  phone: string;
  remark: string;
  rowNumber: number;
  errors: string[];
  warnings: string[];
  isDuplicateName: boolean;
  isDuplicateCase: boolean;
  hasDoctor: boolean;
  confirmed: boolean;
}

export type RecordType = 'stock-in' | 'shelf' | 'handover';

export interface ExportFilter {
  startDate: string;
  endDate: string;
  recordType: RecordType;
}
