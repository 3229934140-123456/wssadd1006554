import { patientStore, alignerStore, shelfStore, handoverStore } from '../store';
import type { Patient, Aligner, Shelf } from '../types';

const INIT_KEY = 'aligner_system_initialized';

export function initializeDemoData(): void {
  const isInitialized = localStorage.getItem(INIT_KEY);
  if (isInitialized) return;

  const patients: Omit<Patient, 'id' | 'createdAt'>[] = [
    { name: '张明华', caseNumber: 'CASE2024001', doctor: '李医生', phone: '13800138001' },
    { name: '李小雨', caseNumber: 'CASE2024002', doctor: '王医生', phone: '13800138002' },
    { name: '王建国', caseNumber: 'CASE2024003', doctor: '李医生', phone: '13800138003' },
    { name: '陈美玲', caseNumber: 'CASE2024004', doctor: '张医生', phone: '13800138004' },
    { name: '张明', caseNumber: 'CASE2024005', doctor: '', phone: '13800138005' },
  ];

  patients.forEach(p => {
    patientStore.create(p);
  });

  const allPatients = patientStore.getAll();

  const shelves: Omit<Shelf, 'id'>[] = [
    { cabinetNumber: 'A', layerNumber: '1', cellNumber: '01', isOccupied: false },
    { cabinetNumber: 'A', layerNumber: '1', cellNumber: '02', isOccupied: false },
    { cabinetNumber: 'A', layerNumber: '1', cellNumber: '03', isOccupied: false },
    { cabinetNumber: 'A', layerNumber: '2', cellNumber: '01', isOccupied: false },
    { cabinetNumber: 'A', layerNumber: '2', cellNumber: '02', isOccupied: false },
    { cabinetNumber: 'A', layerNumber: '2', cellNumber: '03', isOccupied: false },
    { cabinetNumber: 'B', layerNumber: '1', cellNumber: '01', isOccupied: false },
    { cabinetNumber: 'B', layerNumber: '1', cellNumber: '02', isOccupied: false },
    { cabinetNumber: 'B', layerNumber: '2', cellNumber: '01', isOccupied: false },
  ];

  shelves.forEach(s => {
    shelfStore.create(s);
  });

  const patientMap: Record<string, string> = {};
  allPatients.forEach(p => {
    patientMap[p.caseNumber] = p.id;
  });

  const aligners: Omit<Aligner, 'id'>[] = [
    {
      patientId: patientMap['CASE2024001'],
      patientName: '张明华',
      caseNumber: 'CASE2024001',
      stageNumber: '1',
      totalPairs: 20,
      arrivedPairs: 20,
      status: 'stored',
      manufacturer: '隐适美',
      hasDoctorInfo: true,
      arrivedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      storedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      patientId: patientMap['CASE2024002'],
      patientName: '李小雨',
      caseNumber: 'CASE2024002',
      stageNumber: '3',
      totalPairs: 15,
      arrivedPairs: 15,
      status: 'stored',
      manufacturer: '时代天使',
      hasDoctorInfo: true,
      arrivedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      storedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      patientId: patientMap['CASE2024003'],
      patientName: '王建国',
      caseNumber: 'CASE2024003',
      stageNumber: '2',
      totalPairs: 25,
      arrivedPairs: 25,
      status: 'pending',
      manufacturer: '隐适美',
      hasDoctorInfo: true,
      arrivedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      patientId: patientMap['CASE2024004'],
      patientName: '陈美玲',
      caseNumber: 'CASE2024004',
      stageNumber: '1',
      totalPairs: 30,
      arrivedPairs: 10,
      status: 'stored',
      manufacturer: '正雅',
      hasDoctorInfo: true,
      arrivedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      storedDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      patientId: patientMap['CASE2024005'],
      patientName: '张明',
      caseNumber: 'CASE2024005',
      stageNumber: '2',
      totalPairs: 18,
      arrivedPairs: 18,
      status: 'pending',
      manufacturer: '时代天使',
      hasDoctorInfo: false,
      arrivedDate: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  aligners.forEach(a => {
    const aligner = alignerStore.create(a);
    
    if (a.status === 'stored') {
      const allShelves = shelfStore.getAll();
      const emptyShelf = allShelves.find((s: Shelf) => !s.isOccupied);
      if (emptyShelf) {
        shelfStore.update(emptyShelf.id, {
          isOccupied: true,
          alignerId: aligner.id,
        });
        alignerStore.update(aligner.id, {
          shelfId: emptyShelf.id,
          cabinetNumber: emptyShelf.cabinetNumber,
          layerNumber: emptyShelf.layerNumber,
          cellNumber: emptyShelf.cellNumber,
        });
      }
    }
  });

  const storedAligners = alignerStore.getStoredList();
  if (storedAligners.length > 0) {
    const firstAligner = storedAligners[0];
    handoverStore.create({
      alignerId: firstAligner.id,
      patientName: firstAligner.patientName,
      caseNumber: firstAligner.caseNumber,
      receiver: '刘护士',
      receiverRole: '护士',
      pairsTaken: 2,
      purpose: 'chairside_check',
      handoverDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      operator: '管理员',
      remark: '诊室试戴检查',
    });

    handoverStore.create({
      alignerId: firstAligner.id,
      patientName: firstAligner.patientName,
      caseNumber: firstAligner.caseNumber,
      receiver: '王前台',
      receiverRole: '前台',
      pairsTaken: 2,
      purpose: 'clinic_delivery',
      handoverDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      operator: '管理员',
    });
  }

  localStorage.setItem(INIT_KEY, 'true');
}

export function resetDemoData(): void {
  localStorage.removeItem(INIT_KEY);
  localStorage.removeItem('aligner_patients');
  localStorage.removeItem('aligner_aligners');
  localStorage.removeItem('aligner_shelves');
  localStorage.removeItem('aligner_handovers');
  localStorage.removeItem('aligner_inventory_records');
  localStorage.removeItem('aligner_inventory_batches');
  localStorage.removeItem('aligner_operation_logs');
  localStorage.removeItem('aligner_shelf_history');
}
