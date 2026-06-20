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
  originalArrivedPairs?: number;
  status: 'pending' | 'stored' | 'handed_over' | 'returned' | 'damaged';
  shelfId?: string;
  cabinetNumber?: string;
  layerNumber?: string;
  cellNumber?: string;
  manufacturer: string;
  arrivedDate: string;
  storedDate?: string;
  lastHandedOverDate?: string;
  remark?: string;
  hasDoctorInfo: boolean;
  needDoctorInfo?: boolean;
  isBatch?: boolean;
  batchId?: string;
  shelfHistory?: Array<{
    cabinetNumber: string;
    layerNumber: string;
    cellNumber: string;
    storedAt: string;
    removedAt?: string;
  }>;
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
  isRevoked?: boolean;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  isBatch?: boolean;
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

export type OperationType = 'stock-in' | 'shelf-on' | 'shelf-off' | 'inventory' | 'handover' | 'handover-revoke' | 'doctor-update';

export interface OperationLog {
  id: string;
  type: OperationType;
  alignerId?: string;
  patientId?: string;
  patientName: string;
  caseNumber: string;
  stageNumber?: string;
  date: string;
  operator: string;
  description: string;
  details?: Record<string, any>;
}

export interface MonthlyStats {
  year: number;
  month: number;
  stockInCount: number;
  stockInPairs: number;
  shelfOnCount: number;
  shelfOnPairs: number;
  handoverCount: number;
  handoverPairs: number;
  currentInStockCount: number;
  currentInStockPairs: number;
  abnormalInventoryCount: number;
}

export interface ShelfHistoryRecord {
  id: string;
  alignerId: string;
  patientName: string;
  caseNumber: string;
  stageNumber: string;
  cabinetNumber: string;
  layerNumber: string;
  cellNumber: string;
  storedDate: string;
  removedDate?: string;
  removedReason?: string;
  operator?: string;
}
