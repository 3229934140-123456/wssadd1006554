import type { Patient, Aligner, Shelf, HandoverRecord } from '../types';

const STORAGE_KEYS = {
  PATIENTS: 'aligner_patients',
  ALIGNERS: 'aligner_aligners',
  SHELVES: 'aligner_shelves',
  HANDOVERS: 'aligner_handovers',
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
