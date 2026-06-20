import type {
  Patient,
  Aligner,
  Shelf,
  HandoverRecord,
  InventoryRecord,
  InventoryBatch,
  ExportFilter,
  OperationLog,
  ShelfHistoryRecord,
  MonthlyStats,
} from '../types';

const STORAGE_KEYS = {
  PATIENTS: 'aligner_patients',
  ALIGNERS: 'aligner_aligners',
  SHELVES: 'aligner_shelves',
  HANDOVERS: 'aligner_handovers',
  INVENTORY_RECORDS: 'aligner_inventory_records',
  INVENTORY_BATCHES: 'aligner_inventory_batches',
  OPERATION_LOGS: 'aligner_operation_logs',
  SHELF_HISTORY: 'aligner_shelf_history',
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

export const operationStore = {
  getAll(): OperationLog[] {
    return getFromStorage<OperationLog>(STORAGE_KEYS.OPERATION_LOGS)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getByAlignerId(alignerId: string): OperationLog[] {
    return this.getAll()
      .filter(log => log.alignerId === alignerId);
  },

  getByPatientId(patientId: string): OperationLog[] {
    return this.getAll()
      .filter(log => log.patientId === patientId);
  },

  create(log: Omit<OperationLog, 'id'>): OperationLog {
    const logs = getFromStorage<OperationLog>(STORAGE_KEYS.OPERATION_LOGS);
    const newLog: OperationLog = {
      ...log,
      id: generateId(),
    };
    logs.push(newLog);
    saveToStorage(STORAGE_KEYS.OPERATION_LOGS, logs);
    return newLog;
  },
};

export const shelfHistoryStore = {
  getAll(): ShelfHistoryRecord[] {
    return getFromStorage<ShelfHistoryRecord>(STORAGE_KEYS.SHELF_HISTORY)
      .sort((a, b) => new Date(b.storedDate).getTime() - new Date(a.storedDate).getTime());
  },

  getByAlignerId(alignerId: string): ShelfHistoryRecord[] {
    return this.getAll()
      .filter(r => r.alignerId === alignerId);
  },

  create(record: Omit<ShelfHistoryRecord, 'id'>): ShelfHistoryRecord {
    const records = getFromStorage<ShelfHistoryRecord>(STORAGE_KEYS.SHELF_HISTORY);
    const newRecord: ShelfHistoryRecord = {
      ...record,
      id: generateId(),
    };
    records.push(newRecord);
    saveToStorage(STORAGE_KEYS.SHELF_HISTORY, records);
    return newRecord;
  },

  update(id: string, updates: Partial<ShelfHistoryRecord>): ShelfHistoryRecord | undefined {
    const records = getFromStorage<ShelfHistoryRecord>(STORAGE_KEYS.SHELF_HISTORY);
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    records[index] = { ...records[index], ...updates };
    saveToStorage(STORAGE_KEYS.SHELF_HISTORY, records);
    return records[index];
  },

  getByDateRange(startDate: string, endDate: string): ShelfHistoryRecord[] {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate + 'T23:59:59').getTime();
    return this.getAll().filter(r => {
      const storedTime = new Date(r.storedDate).getTime();
      return storedTime >= start && storedTime <= end;
    });
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

    operationStore.create({
      type: 'stock-in',
      alignerId: newAligner.id,
      patientId: newAligner.patientId,
      patientName: newAligner.patientName,
      caseNumber: newAligner.caseNumber,
      stageNumber: newAligner.stageNumber,
      date: new Date().toISOString(),
      operator: 'system',
      description: `牙套入库：${newAligner.patientName} ${newAligner.caseNumber} 第${newAligner.stageNumber}阶段，到货${newAligner.arrivedPairs}副`,
      details: {
        manufacturer: newAligner.manufacturer,
        arrivedPairs: newAligner.arrivedPairs,
        totalPairs: newAligner.totalPairs,
      },
    });

    return newAligner;
  },

  update(id: string, updates: Partial<Aligner>): Aligner | undefined {
    const aligners = this.getAll();
    const index = aligners.findIndex(a => a.id === id);
    if (index === -1) return undefined;

    const oldAligner = aligners[index];
    const newAligner = { ...oldAligner, ...updates };
    aligners[index] = newAligner;
    saveToStorage(STORAGE_KEYS.ALIGNERS, aligners);

    if (updates.hasDoctorInfo !== undefined && updates.hasDoctorInfo !== oldAligner.hasDoctorInfo) {
      const patient = patientStore.getById(newAligner.patientId);
      operationStore.create({
        type: 'doctor-update',
        alignerId: newAligner.id,
        patientId: newAligner.patientId,
        patientName: newAligner.patientName,
        caseNumber: newAligner.caseNumber,
        stageNumber: newAligner.stageNumber,
        date: new Date().toISOString(),
        operator: 'system',
        description: `医生信息更新：${newAligner.patientName} ${newAligner.caseNumber}，${updates.hasDoctorInfo ? '已补录' : '已清除'}医生信息`,
        details: {
          hasDoctorInfo: updates.hasDoctorInfo,
          doctor: patient?.doctor || '',
        },
      });
    }

    const wasOnShelf = !!oldAligner.shelfId;
    const isNowOnShelf = !!newAligner.shelfId;

    if (!wasOnShelf && isNowOnShelf && newAligner.cabinetNumber && newAligner.layerNumber && newAligner.cellNumber) {
      operationStore.create({
        type: 'shelf-on',
        alignerId: newAligner.id,
        patientId: newAligner.patientId,
        patientName: newAligner.patientName,
        caseNumber: newAligner.caseNumber,
        stageNumber: newAligner.stageNumber,
        date: new Date().toISOString(),
        operator: 'system',
        description: `牙套上架：${newAligner.patientName} ${newAligner.caseNumber} 第${newAligner.stageNumber}阶段，柜位 ${newAligner.cabinetNumber}-${newAligner.layerNumber}-${newAligner.cellNumber}`,
        details: {
          cabinetNumber: newAligner.cabinetNumber,
          layerNumber: newAligner.layerNumber,
          cellNumber: newAligner.cellNumber,
        },
      });

      shelfHistoryStore.create({
        alignerId: newAligner.id,
        patientName: newAligner.patientName,
        caseNumber: newAligner.caseNumber,
        stageNumber: newAligner.stageNumber,
        cabinetNumber: newAligner.cabinetNumber,
        layerNumber: newAligner.layerNumber,
        cellNumber: newAligner.cellNumber,
        storedDate: newAligner.storedDate || new Date().toISOString(),
        operator: 'system',
      });
    }

    if (wasOnShelf && !isNowOnShelf && oldAligner.cabinetNumber && oldAligner.layerNumber && oldAligner.cellNumber) {
      operationStore.create({
        type: 'shelf-off',
        alignerId: newAligner.id,
        patientId: newAligner.patientId,
        patientName: newAligner.patientName,
        caseNumber: newAligner.caseNumber,
        stageNumber: newAligner.stageNumber,
        date: new Date().toISOString(),
        operator: 'system',
        description: `牙套下架：${newAligner.patientName} ${newAligner.caseNumber} 第${newAligner.stageNumber}阶段，原柜位 ${oldAligner.cabinetNumber}-${oldAligner.layerNumber}-${oldAligner.cellNumber}`,
        details: {
          cabinetNumber: oldAligner.cabinetNumber,
          layerNumber: oldAligner.layerNumber,
          cellNumber: oldAligner.cellNumber,
          reason: updates.status || '下架',
        },
      });

      const histories = shelfHistoryStore.getByAlignerId(newAligner.id);
      const activeHistory = histories.find(h => !h.removedDate && h.cabinetNumber === oldAligner.cabinetNumber && h.layerNumber === oldAligner.layerNumber && h.cellNumber === oldAligner.cellNumber);
      if (activeHistory) {
        shelfHistoryStore.update(activeHistory.id, {
          removedDate: new Date().toISOString(),
          removedReason: updates.status || '下架',
        });
      }
    }

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

  revoke(id: string, reason: string, operator: string): HandoverRecord | undefined {
    const records = this.getAll();
    const index = records.findIndex(h => h.id === id);
    if (index === -1) return undefined;

    const record = records[index];
    if (record.isRevoked) return undefined;

    records[index] = {
      ...record,
      isRevoked: true,
      revokedAt: new Date().toISOString(),
      revokedBy: operator,
      revokeReason: reason,
    };
    saveToStorage(STORAGE_KEYS.HANDOVERS, records);

    const aligner = alignerStore.getById(record.alignerId);
    if (aligner) {
      const newArrivedPairs = aligner.arrivedPairs + record.pairsTaken;
      let newStatus = aligner.status;
      if (['handed_over', 'returned', 'damaged'].includes(aligner.status) && newArrivedPairs > 0) {
        newStatus = 'stored';
      }
      alignerStore.update(aligner.id, {
        arrivedPairs: newArrivedPairs,
        status: newStatus,
      });

      if (aligner.shelfId) {
        const shelf = shelfStore.getById(aligner.shelfId);
        if (shelf && !shelf.isOccupied) {
          shelfStore.update(shelf.id, {
            isOccupied: true,
            alignerId: aligner.id,
          });
        }
      }

      operationStore.create({
        type: 'handover-revoke',
        alignerId: aligner.id,
        patientId: aligner.patientId,
        patientName: record.patientName,
        caseNumber: record.caseNumber,
        stageNumber: aligner.stageNumber,
        date: new Date().toISOString(),
        operator: operator,
        description: `撤销交接：${record.patientName} ${record.caseNumber}，撤销原因：${reason}，恢复${record.pairsTaken}副`,
        details: {
          handoverId: id,
          pairsRestored: record.pairsTaken,
          revokeReason: reason,
          originalReceiver: record.receiver,
        },
      });
    }

    return records[index];
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

export function calculateMonthlyStats(year: number, month: number): MonthlyStats {
  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();

  const aligners = alignerStore.getAll();
  const handovers = handoverStore.getAll();
  const inventoryRecords = inventoryStore.getAllRecords();
  const shelfHistories = shelfHistoryStore.getAll();

  const stockInAligners = aligners.filter(a => {
    const arrivedTime = new Date(a.arrivedDate).getTime();
    return arrivedTime >= startOfMonth && arrivedTime <= endOfMonth;
  });

  const stockInCount = stockInAligners.length;
  const stockInPairs = stockInAligners.reduce((sum, a) => sum + a.arrivedPairs, 0);

  const shelfOnRecords = shelfHistories.filter(h => {
    const storedTime = new Date(h.storedDate).getTime();
    return storedTime >= startOfMonth && storedTime <= endOfMonth;
  });

  const shelfOnCount = shelfOnRecords.length;
  let shelfOnPairs = 0;
  shelfOnRecords.forEach(h => {
    const aligner = aligners.find(a => a.id === h.alignerId);
    if (aligner) {
      shelfOnPairs += aligner.arrivedPairs;
    }
  });

  const validHandovers = handovers.filter(h => {
    const handoverTime = new Date(h.handoverDate).getTime();
    return handoverTime >= startOfMonth && handoverTime <= endOfMonth && !h.isRevoked;
  });

  const handoverCount = validHandovers.length;
  const handoverPairs = validHandovers.reduce((sum, h) => sum + h.pairsTaken, 0);

  const storedAligners = aligners.filter(a => a.status === 'stored');
  const currentInStockCount = storedAligners.length;
  const currentInStockPairs = storedAligners.reduce((sum, a) => sum + a.arrivedPairs, 0);

  const abnormalInventoryCount = inventoryRecords.filter(r => {
    const inventoryTime = new Date(r.inventoryDate).getTime();
    return inventoryTime >= startOfMonth && inventoryTime <= endOfMonth && 
           (r.status === 'mismatch' || r.status === 'missing');
  }).length;

  return {
    year,
    month,
    stockInCount,
    stockInPairs,
    shelfOnCount,
    shelfOnPairs,
    handoverCount,
    handoverPairs,
    currentInStockCount,
    currentInStockPairs,
    abnormalInventoryCount,
  };
}

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
      const histories = shelfHistoryStore.getByDateRange(startDate, endDate);
      headers = ['上架日期', '下架日期', '患者姓名', '病例号', '阶段编号', '柜号', '层号', '格口', '副数', '厂家', '主治医生', '下架原因'];
      data = histories.map(h => {
        const aligner = alignerStore.getById(h.alignerId);
        const patient = aligner ? patientStore.getById(aligner.patientId) : undefined;
        return [
          new Date(h.storedDate).toLocaleDateString('zh-CN'),
          h.removedDate ? new Date(h.removedDate).toLocaleDateString('zh-CN') : '-',
          h.patientName,
          h.caseNumber,
          `第${h.stageNumber}阶段`,
          h.cabinetNumber,
          h.layerNumber,
          h.cellNumber,
          aligner?.arrivedPairs || '-',
          aligner?.manufacturer || '-',
          patient?.doctor || '待补录',
          h.removedReason || '-',
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
