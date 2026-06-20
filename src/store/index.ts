import type { Patient, Aligner, Shelf, HandoverRecord, InventoryRecord, InventoryBatch, ExportFilter } from '../types';

const STORAGE_KEYS = {
  PATIENTS: 'aligner_patients',
  ALIGNERS: 'aligner_aligners',
  SHELVES: 'aligner_shelves',
  HANDOVERS: 'aligner_handovers',
  INVENTORY_RECORDS: 'aligner_inventory_records',
  INVENTORY_BATCHES: 'aligner_inventory_batches',
};

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getFromStorage<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export const patientStore = {
  getAll(): Patient[] {
    return getFromStorage<Patient>(STORAGE_KEYS.PATIENTS);
  },

  getById(id: string): Patient | undefined {
    return this.getAll().find(p => p.id === id);
  },

  findByName(name: string): Patient[] {
    return this.getAll().filter(p => 
      p.name === name || p.name.includes(name)
    );
  },

  findByCaseNumber(caseNumber: string): Patient | undefined {
    return this.getAll().find(p => p.caseNumber === caseNumber);
  },

  create(patient: Omit<Patient, 'id' | 'createdAt'>): Patient {
    const patients = this.getAll();
    const newPatient: Patient = {
      ...patient,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    patients.push(newPatient);
    saveToStorage(STORAGE_KEYS.PATIENTS, patients);
    return newPatient;
  },

  update(id: string, updates: Partial<Patient>): Patient | undefined {
    const patients = this.getAll();
    const index = patients.findIndex(p => p.id === id);
    if (index === -1) return undefined;
    patients[index] = { ...patients[index], ...updates };
    saveToStorage(STORAGE_KEYS.PATIENTS, patients);
    return patients[index];
  },
};

export const alignerStore = {
  getAll(): Aligner[] {
    return getFromStorage<Aligner>(STORAGE_KEYS.ALIGNERS);
  },

  getById(id: string): Aligner | undefined {
    return this.getAll().find(a => a.id === id);
  },

  getPendingList(): Aligner[] {
    return this.getAll().filter(a => a.status === 'pending');
  },

  getStoredList(): Aligner[] {
    return this.getAll().filter(a => a.status === 'stored');
  },

  findByPatientName(name: string): Aligner[] {
    return this.getAll().filter(a => 
      a.patientName.includes(name)
    );
  },

  findByCaseNumber(caseNumber: string): Aligner[] {
    return this.getAll().filter(a => 
      a.caseNumber === caseNumber || a.caseNumber.includes(caseNumber)
    );
  },

  create(aligner: Omit<Aligner, 'id'>): Aligner {
    const aligners = this.getAll();
    const newAligner: Aligner = {
      ...aligner,
      id: generateId(),
    };
    aligners.push(newAligner);
    saveToStorage(STORAGE_KEYS.ALIGNERS, aligners);
    return newAligner;
  },

  update(id: string, updates: Partial<Aligner>): Aligner | undefined {
    const aligners = this.getAll();
    const index = aligners.findIndex(a => a.id === id);
    if (index === -1) return undefined;
    aligners[index] = { ...aligners[index], ...updates };
    saveToStorage(STORAGE_KEYS.ALIGNERS, aligners);
    return aligners[index];
  },

  delete(id: string): boolean {
    const aligners = this.getAll();
    const filtered = aligners.filter(a => a.id !== id);
    if (filtered.length === aligners.length) return false;
    saveToStorage(STORAGE_KEYS.ALIGNERS, filtered);
    return true;
  },

  search(keyword: string): Aligner[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAll().filter(a =>
      a.patientName.toLowerCase().includes(lowerKeyword) ||
      a.caseNumber.toLowerCase().includes(lowerKeyword) ||
      a.stageNumber.toLowerCase().includes(lowerKeyword)
    );
  },
};

export const shelfStore = {
  getAll(): Shelf[] {
    return getFromStorage<Shelf>(STORAGE_KEYS.SHELVES);
  },

  getAvailableShelves(): Shelf[] {
    return this.getAll().filter(s => !s.isOccupied);
  },

  getOccupiedShelves(): Shelf[] {
    return this.getAll().filter(s => s.isOccupied);
  },

  getById(id: string): Shelf | undefined {
    return this.getAll().find(s => s.id === id);
  },

  create(shelf: Omit<Shelf, 'id'>): Shelf {
    const shelves = this.getAll();
    const newShelf: Shelf = {
      ...shelf,
      id: generateId(),
    };
    shelves.push(newShelf);
    saveToStorage(STORAGE_KEYS.SHELVES, shelves);
    return newShelf;
  },

  update(id: string, updates: Partial<Shelf>): Shelf | undefined {
    const shelves = this.getAll();
    const index = shelves.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    shelves[index] = { ...shelves[index], ...updates };
    saveToStorage(STORAGE_KEYS.SHELVES, shelves);
    return shelves[index];
  },

  delete(id: string): boolean {
    const shelves = this.getAll();
    const filtered = shelves.filter(s => s.id !== id);
    if (filtered.length === shelves.length) return false;
    saveToStorage(STORAGE_KEYS.SHELVES, filtered);
    return true;
  },

  getByPosition(cabinetNumber: string, layerNumber: string, cellNumber: string): Shelf | undefined {
    return this.getAll().find(
      s => s.cabinetNumber === cabinetNumber && 
           s.layerNumber === layerNumber && 
           s.cellNumber === cellNumber
    );
  },

  getAllCabinetNumbers(): string[] {
    const shelves = this.getAll();
    return [...new Set(shelves.map(s => s.cabinetNumber))].sort();
  },

  getLayersByCabinet(cabinetNumber: string): string[] {
    const shelves = this.getAll().filter(s => s.cabinetNumber === cabinetNumber);
    return [...new Set(shelves.map(s => s.layerNumber))].sort();
  },

  getCellsByLayer(cabinetNumber: string, layerNumber: string): string[] {
    const shelves = this.getAll().filter(
      s => s.cabinetNumber === cabinetNumber && s.layerNumber === layerNumber
    );
    return [...new Set(shelves.map(s => s.cellNumber))].sort();
  },
};

export const handoverStore = {
  getAll(): HandoverRecord[] {
    return getFromStorage<HandoverRecord>(STORAGE_KEYS.HANDOVERS);
  },

  getByAlignerId(alignerId: string): HandoverRecord[] {
    return this.getAll()
      .filter(h => h.alignerId === alignerId)
      .sort((a, b) => new Date(b.handoverDate).getTime() - new Date(a.handoverDate).getTime());
  },

  create(record: Omit<HandoverRecord, 'id'>): HandoverRecord {
    const records = this.getAll();
    const newRecord: HandoverRecord = {
      ...record,
      id: generateId(),
    };
    records.push(newRecord);
    saveToStorage(STORAGE_KEYS.HANDOVERS, records);
    return newRecord;
  },

  search(keyword: string): HandoverRecord[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAll().filter(h =>
      h.patientName.toLowerCase().includes(lowerKeyword) ||
      h.caseNumber.toLowerCase().includes(lowerKeyword) ||
      h.receiver.toLowerCase().includes(lowerKeyword)
    ).sort((a, b) => new Date(b.handoverDate).getTime() - new Date(a.handoverDate).getTime());
  },
};

export const inventoryStore = {
  getAllRecords(): InventoryRecord[] {
    return getFromStorage<InventoryRecord>(STORAGE_KEYS.INVENTORY_RECORDS);
  },

  getRecordsByBatch(batchId: string): InventoryRecord[] {
    return this.getAllRecords()
      .filter(r => r.inventoryBatchId === batchId)
      .sort((a, b) => {
        if (a.layerNumber !== b.layerNumber) return a.layerNumber.localeCompare(b.layerNumber);
        return a.cellNumber.localeCompare(b.cellNumber);
      });
  },

  getRecordsByCabinet(cabinetNumber: string): InventoryRecord[] {
    return this.getAllRecords()
      .filter(r => r.cabinetNumber === cabinetNumber)
      .sort((a, b) => new Date(b.inventoryDate).getTime() - new Date(a.inventoryDate).getTime());
  },

  getAllBatches(): InventoryBatch[] {
    return getFromStorage<InventoryBatch>(STORAGE_KEYS.INVENTORY_BATCHES)
      .sort((a, b) => new Date(b.inventoryDate).getTime() - new Date(a.inventoryDate).getTime());
  },

  getBatchById(id: string): InventoryBatch | undefined {
    return this.getAllBatches().find(b => b.id === id);
  },

  createBatch(batch: Omit<InventoryBatch, 'id'>): InventoryBatch {
    const batches = this.getAllBatches();
    const newBatch: InventoryBatch = {
      ...batch,
      id: generateId(),
    };
    batches.push(newBatch);
    saveToStorage(STORAGE_KEYS.INVENTORY_BATCHES, batches);
    return newBatch;
  },

  updateBatch(id: string, updates: Partial<InventoryBatch>): InventoryBatch | undefined {
    const batches = this.getAllBatches();
    const index = batches.findIndex(b => b.id === id);
    if (index === -1) return undefined;
    batches[index] = { ...batches[index], ...updates };
    saveToStorage(STORAGE_KEYS.INVENTORY_BATCHES, batches);
    return batches[index];
  },

  createRecord(record: Omit<InventoryRecord, 'id'>): InventoryRecord {
    const records = this.getAllRecords();
    const newRecord: InventoryRecord = {
      ...record,
      id: generateId(),
    };
    records.push(newRecord);
    saveToStorage(STORAGE_KEYS.INVENTORY_RECORDS, records);
    return newRecord;
  },

  updateRecord(id: string, updates: Partial<InventoryRecord>): InventoryRecord | undefined {
    const records = this.getAllRecords();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    records[index] = { ...records[index], ...updates };
    saveToStorage(STORAGE_KEYS.INVENTORY_RECORDS, records);
    return records[index];
  },

  bulkCreateRecords(records: Omit<InventoryRecord, 'id'>[]): InventoryRecord[] {
    const existingRecords = this.getAllRecords();
    const newRecords: InventoryRecord[] = records.map(r => ({
      ...r,
      id: generateId(),
    }));
    saveToStorage(STORAGE_KEYS.INVENTORY_RECORDS, [...existingRecords, ...newRecords]);
    return newRecords;
  },
};

export function exportRecords(filter: ExportFilter): string {
  const { startDate, endDate, recordType } = filter;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate + 'T23:59:59').getTime();

  let data: any[] = [];
  let headers: string[] = [];

  switch (recordType) {
    case 'stock-in': {
      const aligners = alignerStore.getAll().filter(a => {
        const arrivedTime = new Date(a.arrivedDate).getTime();
        return arrivedTime >= start && arrivedTime <= end;
      });
      headers = ['到货日期', '患者姓名', '病例号', '阶段编号', '厂家', '到货副数', '总副数', '主治医生', '状态', '柜位', '备注'];
      data = aligners.map(a => [
        new Date(a.arrivedDate).toLocaleDateString('zh-CN'),
        a.patientName,
        a.caseNumber,
        `第${a.stageNumber}阶段`,
        a.manufacturer,
        a.arrivedPairs,
        a.totalPairs,
        a.hasDoctorInfo ? (patientStore.getById(a.patientId)?.doctor || '-') : '待补录',
        a.status === 'pending' ? '待上架' :
        a.status === 'stored' ? '已上架' :
        a.status === 'handed_over' ? '已领取' :
        a.status === 'returned' ? '已退回' : '已损坏',
        a.cabinetNumber ? `${a.cabinetNumber}柜-${a.layerNumber}层-${a.cellNumber}格` : '-',
        a.remark || '',
      ]);
      break;
    }
    case 'shelf': {
      const shelves = shelfStore.getAll().filter(s => s.isOccupied);
      headers = ['柜号', '层号', '格口', '患者姓名', '病例号', '阶段编号', '厂家', '副数', '上架日期', '主治医生'];
      data = shelves.map(s => {
        const aligner = s.alignerId ? alignerStore.getById(s.alignerId) : undefined;
        const patient = aligner ? patientStore.getById(aligner.patientId) : undefined;
        return [
          s.cabinetNumber,
          s.layerNumber,
          s.cellNumber,
          aligner?.patientName || '-',
          aligner?.caseNumber || '-',
          aligner ? `第${aligner.stageNumber}阶段` : '-',
          aligner?.manufacturer || '-',
          aligner?.arrivedPairs || '-',
          aligner?.storedDate ? new Date(aligner.storedDate).toLocaleDateString('zh-CN') : '-',
          patient?.doctor || '待补录',
        ];
      });
      break;
    }
    case 'handover': {
      const handovers = handoverStore.getAll().filter(h => {
        const handoverTime = new Date(h.handoverDate).getTime();
        return handoverTime >= start && handoverTime <= end;
      });
      headers = ['交接日期', '患者姓名', '病例号', '领取人', '身份', '领取副数', '用途', '操作员', '备注'];
      data = handovers.map(h => [
        new Date(h.handoverDate).toLocaleString('zh-CN'),
        h.patientName,
        h.caseNumber,
        h.receiver,
        h.receiverRole,
        h.pairsTaken,
        h.purpose === 'clinic_delivery' ? '当场发放' :
        h.purpose === 'chairside_check' ? '诊室检查' :
        h.purpose === 'return' ? '退回' :
        h.purpose === 'reissue' ? '补发' : '包装损坏',
        h.operator,
        h.remark || '',
      ]);
      break;
    }
  }

  const csvContent = [
    headers.join(','),
    ...data.map(row => row.map((cell: string | number) => `"${cell}"`).join(',')),
  ].join('\n');

  const BOM = '\uFEFF';
  return BOM + csvContent;
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
