import { useState, useEffect } from 'react';
import { shelfStore, alignerStore, inventoryStore } from '../store';
import type { Shelf, Aligner, InventoryRecord, InventoryBatch } from '../types';
import LabelPrintModal from '../components/LabelPrintModal';

interface ShelfPageProps {
  onShelfChange?: () => void;
}

type InventoryStatus = 'normal' | 'empty' | 'mismatch' | 'missing';

interface CellCheckState {
  shelfId: string;
  layerNumber: string;
  cellNumber: string;
  status: InventoryStatus | null;
  actualPatientName: string;
  actualCaseNumber: string;
  remark: string;
  isChecked: boolean;
  expectedAligner: Aligner | null;
}

function ShelfPage({ onShelfChange }: ShelfPageProps) {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [pendingAligners, setPendingAligners] = useState<Aligner[]>([]);
  const [storedAligners, setStoredAligners] = useState<Aligner[]>([]);
  const [selectedAligner, setSelectedAligner] = useState<Aligner | null>(null);
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelAligner, setLabelAligner] = useState<Aligner | null>(null);
  
  const [newShelf, setNewShelf] = useState({
    cabinetNumber: '',
    layerNumber: '',
    cellNumber: '',
  });

  const [shelfForm, setShelfForm] = useState({
    cabinetNumber: '',
    layerNumber: '',
    cellNumber: '',
  });

  const [activeTab, setActiveTab] = useState<'pending' | 'stored' | 'shelves' | 'inventory'>('pending');

  const [inventoryCabinet, setInventoryCabinet] = useState('');
  const [inventoryBy, setInventoryBy] = useState('');
  const [currentBatch, setCurrentBatch] = useState<InventoryBatch | null>(null);
  const [cellCheckStates, setCellCheckStates] = useState<CellCheckState[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryBatch[]>([]);
  const [selectedHistoryBatch, setSelectedHistoryBatch] = useState<InventoryBatch | null>(null);
  const [historyRecords, setHistoryRecords] = useState<InventoryRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'pending' || activeTab === 'stored') {
      loadData();
    }
  }, [activeTab]);

  const loadData = () => {
    setShelves(shelfStore.getAll());
    setPendingAligners(alignerStore.getPendingList().sort((a, b) => 
      new Date(b.arrivedDate).getTime() - new Date(a.arrivedDate).getTime()
    ));
    setStoredAligners(alignerStore.getStoredList().sort((a, b) => 
      new Date(b.storedDate || '').getTime() - new Date(a.storedDate || '').getTime()
    ));
  };

  const handleAddShelf = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newShelf.cabinetNumber.trim() || !newShelf.layerNumber.trim() || !newShelf.cellNumber.trim()) {
      alert('请填写完整的柜号、层号和格口号');
      return;
    }

    const existing = shelfStore.getByPosition(
      newShelf.cabinetNumber.trim(),
      newShelf.layerNumber.trim(),
      newShelf.cellNumber.trim()
    );

    if (existing) {
      alert('该柜位已存在');
      return;
    }

    shelfStore.create({
      cabinetNumber: newShelf.cabinetNumber.trim(),
      layerNumber: newShelf.layerNumber.trim(),
      cellNumber: newShelf.cellNumber.trim(),
      isOccupied: false,
    });

    setNewShelf({ cabinetNumber: '', layerNumber: '', cellNumber: '' });
    loadData();
  };

  const handleOpenShelfModal = (aligner: Aligner) => {
    setSelectedAligner(aligner);
    setShelfForm({
      cabinetNumber: '',
      layerNumber: '',
      cellNumber: '',
    });
    setShowShelfModal(true);
  };

  const handleShelfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAligner) return;

    if (!shelfForm.cabinetNumber.trim() || !shelfForm.layerNumber.trim() || !shelfForm.cellNumber.trim()) {
      alert('请选择完整的柜号、层号和格口');
      return;
    }

    const cabinetNumber = shelfForm.cabinetNumber.trim();
    const layerNumber = shelfForm.layerNumber.trim();
    const cellNumber = shelfForm.cellNumber.trim();

    let shelf = shelfStore.getByPosition(cabinetNumber, layerNumber, cellNumber);

    if (!shelf) {
      shelf = shelfStore.create({
        cabinetNumber,
        layerNumber,
        cellNumber,
        isOccupied: false,
      });
    }

    if (shelf.isOccupied) {
      alert('该柜位已被占用，请选择其他位置');
      return;
    }

    shelfStore.update(shelf.id, {
      isOccupied: true,
      alignerId: selectedAligner.id,
    });

    alignerStore.update(selectedAligner.id, {
      status: 'stored',
      shelfId: shelf.id,
      cabinetNumber,
      layerNumber,
      cellNumber,
      storedDate: new Date().toISOString(),
    });

    setShowShelfModal(false);
    setSelectedAligner(null);
    loadData();
    onShelfChange?.();
  };

  const handleRemoveShelf = (shelfId: string) => {
    const shelf = shelfStore.getById(shelfId);
    if (!shelf) return;

    if (shelf.isOccupied && shelf.alignerId) {
      if (!confirm('该柜位有存放的牙套，确定要移除此柜位吗？')) {
        return;
      }
      alignerStore.update(shelf.alignerId, {
        status: 'pending',
        shelfId: undefined,
        cabinetNumber: undefined,
        layerNumber: undefined,
        cellNumber: undefined,
        storedDate: undefined,
      });
    }

    shelfStore.delete(shelfId);
    loadData();
    onShelfChange?.();
  };

  const handleRemoveAligner = (alignerId: string) => {
    if (!confirm('确定要将牙套移出柜位吗？移出后将回到待上架清单。')) {
      return;
    }

    const aligner = alignerStore.getById(alignerId);
    if (!aligner || !aligner.shelfId) return;

    shelfStore.update(aligner.shelfId, {
      isOccupied: false,
      alignerId: undefined,
    });

    alignerStore.update(alignerId, {
      status: 'pending',
      shelfId: undefined,
      cabinetNumber: undefined,
      layerNumber: undefined,
      cellNumber: undefined,
      storedDate: undefined,
    });

    loadData();
    onShelfChange?.();
  };

  const handlePrintLabel = (aligner: Aligner) => {
    setLabelAligner(aligner);
    setShowLabelModal(true);
  };

  const cabinetNumbers = shelfStore.getAllCabinetNumbers();

  const getShelvesByCabinet = (cabinet: string) => {
    return shelves.filter(s => s.cabinetNumber === cabinet).sort((a, b) => {
      if (a.layerNumber !== b.layerNumber) {
        return a.layerNumber.localeCompare(b.layerNumber);
      }
      return a.cellNumber.localeCompare(b.cellNumber);
    });
  };

  const occupiedCount = shelves.filter(s => s.isOccupied).length;
  const availableCount = shelves.filter(s => !s.isOccupied).length;

  const startInventory = () => {
    if (!inventoryCabinet.trim()) {
      alert('请选择柜号');
      return;
    }
    if (!inventoryBy.trim()) {
      alert('请输入盘点人');
      return;
    }

    const cabinetShelves = getShelvesByCabinet(inventoryCabinet);
    if (cabinetShelves.length === 0) {
      alert('该柜号下没有柜位');
      return;
    }

    const batch = inventoryStore.createBatch({
      cabinetNumber: inventoryCabinet,
      inventoryBy: inventoryBy.trim(),
      inventoryDate: new Date().toISOString(),
      status: 'in_progress',
      totalCount: cabinetShelves.length,
      normalCount: 0,
      emptyCount: 0,
      mismatchCount: 0,
      missingCount: 0,
    });

    setCurrentBatch(batch);

    const checkStates: CellCheckState[] = cabinetShelves.map(shelf => {
      const expectedAligner = shelf.alignerId 
        ? alignerStore.getById(shelf.alignerId) || null
        : null;
      return {
        shelfId: shelf.id,
        layerNumber: shelf.layerNumber,
        cellNumber: shelf.cellNumber,
        status: null,
        actualPatientName: '',
        actualCaseNumber: '',
        remark: '',
        isChecked: false,
        expectedAligner,
      };
    });

    setCellCheckStates(checkStates);
    loadInventoryHistory();
  };

  const handleCellStatusChange = (shelfId: string, status: InventoryStatus) => {
    setCellCheckStates(prev => prev.map(cell => 
      cell.shelfId === shelfId ? { ...cell, status } : cell
    ));
  };

  const handleCellActualPatientChange = (shelfId: string, field: 'patientName' | 'caseNumber', value: string) => {
    setCellCheckStates(prev => prev.map(cell => 
      cell.shelfId === shelfId 
        ? { 
            ...cell, 
            actualPatientName: field === 'patientName' ? value : cell.actualPatientName,
            actualCaseNumber: field === 'caseNumber' ? value : cell.actualCaseNumber,
          } 
        : cell
    ));
  };

  const handleCellRemarkChange = (shelfId: string, remark: string) => {
    setCellCheckStates(prev => prev.map(cell => 
      cell.shelfId === shelfId ? { ...cell, remark } : cell
    ));
  };

  const confirmCellCheck = (shelfId: string) => {
    const cell = cellCheckStates.find(c => c.shelfId === shelfId);
    if (!cell) return;

    if (!cell.status) {
      alert('请选择核对结果');
      return;
    }

    if (cell.status === 'mismatch' && (!cell.actualPatientName.trim() && !cell.actualCaseNumber.trim())) {
      alert('错放时请输入实际的患者姓名或病例号');
      return;
    }

    setCellCheckStates(prev => prev.map(c => 
      c.shelfId === shelfId ? { ...c, isChecked: true } : c
    ));
  };

  const getInventoryStats = () => {
    const checked = cellCheckStates.filter(c => c.isChecked);
    return {
      total: cellCheckStates.length,
      checked: checked.length,
      normal: checked.filter(c => c.status === 'normal').length,
      empty: checked.filter(c => c.status === 'empty').length,
      mismatch: checked.filter(c => c.status === 'mismatch').length,
      missing: checked.filter(c => c.status === 'missing').length,
    };
  };

  const endInventory = () => {
    if (!currentBatch) return;

    const unchecked = cellCheckStates.filter(c => !c.isChecked);
    if (unchecked.length > 0) {
      alert(`还有 ${unchecked.length} 个格口未核对，请完成所有格口的核对后再结束盘点`);
      return;
    }

    const stats = getInventoryStats();

    const records: Omit<InventoryRecord, 'id'>[] = cellCheckStates.map(cell => ({
        cabinetNumber: inventoryCabinet,
        layerNumber: cell.layerNumber,
        cellNumber: cell.cellNumber,
        shelfId: cell.shelfId,
        expectedAlignerId: cell.expectedAligner?.id,
        expectedPatientName: cell.expectedAligner?.patientName,
        expectedCaseNumber: cell.expectedAligner?.caseNumber,
        expectedStageNumber: cell.expectedAligner?.stageNumber,
        status: cell.status!,
        actualAlignerId: cell.status === 'mismatch' ? undefined : undefined,
        actualPatientName: cell.status === 'mismatch' ? cell.actualPatientName || undefined : undefined,
        actualCaseNumber: cell.status === 'mismatch' ? cell.actualCaseNumber || undefined : undefined,
        actualStageNumber: undefined,
        remark: cell.remark || undefined,
        inventoryBy: currentBatch.inventoryBy,
        inventoryDate: new Date().toISOString(),
        inventoryBatchId: currentBatch.id,
      }));

    inventoryStore.bulkCreateRecords(records);

    inventoryStore.updateBatch(currentBatch.id, {
      status: 'completed',
      normalCount: stats.normal,
      emptyCount: stats.empty,
      mismatchCount: stats.mismatch,
      missingCount: stats.missing,
    });

    alert('盘点完成！\n\n' +
      `总格口数: ${stats.total}\n` +
      `正常: ${stats.normal}\n` +
      `空格: ${stats.empty}\n` +
      `错放: ${stats.mismatch}\n` +
      `缺失: ${stats.missing}`);

    setCurrentBatch(null);
    setCellCheckStates([]);
    setInventoryBy('');
    loadInventoryHistory();
    loadData();
    onShelfChange?.();
  };

  const cancelInventory = () => {
    if (!confirm('确定要取消当前盘点吗？未保存的数据将丢失。')) {
      return;
    }
    if (currentBatch) {
      const existingRecords = inventoryStore.getRecordsByBatch(currentBatch.id);
      if (existingRecords.length === 0) {
        const batches = inventoryStore.getAllBatches().filter(b => b.id !== currentBatch.id);
        localStorage.setItem('aligner_inventory_batches', JSON.stringify(batches));
      }
    }
    setCurrentBatch(null);
    setCellCheckStates([]);
  };

  const loadInventoryHistory = () => {
    if (inventoryCabinet) {
      const batches = inventoryStore.getAllBatches()
        .filter(b => b.cabinetNumber === inventoryCabinet && b.status === 'completed');
      setInventoryHistory(batches);
    } else {
      setInventoryHistory([]);
    }
  };

  const viewHistoryDetail = (batch: InventoryBatch) => {
    setSelectedHistoryBatch(batch);
    const records = inventoryStore.getRecordsByBatch(batch.id);
    setHistoryRecords(records);
    setShowHistoryModal(true);
  };

  const getStatusColor = (status: InventoryStatus | null) => {
    switch (status) {
      case 'normal': return { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700' };
      case 'empty': return { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' };
      case 'mismatch': return { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-700' };
      case 'missing': return { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700' };
      default: return { bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-700' };
    }
  };

  const getStatusBadgeStyle = (status: InventoryStatus) => {
    switch (status) {
      case 'normal': return { background: '#e8f5e9', color: '#2e7d32' };
      case 'empty': return { background: '#f5f5f5', color: '#616161' };
      case 'mismatch': return { background: '#fff3e0', color: '#e65100' };
      case 'missing': return { background: '#ffebee', color: '#c62828' };
    }
  };

  const getStatusText = (status: InventoryStatus) => {
    switch (status) {
      case 'normal': return '正常';
      case 'empty': return '空格';
      case 'mismatch': return '错放';
      case 'missing': return '缺失';
    }
  };

  const inventoryStats = currentBatch ? getInventoryStats() : { total: 0, checked: 0, normal: 0, empty: 0, mismatch: 0, missing: 0 };

  const layers = [...new Set(cellCheckStates.map(c => c.layerNumber))].sort();

  useEffect(() => {
    if (activeTab === 'inventory') {
      loadInventoryHistory();
    }
  }, [activeTab, inventoryCabinet]);

  return (
    <div className="shelf-page">
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-icon">🗄️</span>
          <div className="stat-info">
            <span className="stat-value">{shelves.length}</span>
            <span className="stat-label">总柜位数</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📦</span>
          <div className="stat-info">
            <span className="stat-value">{occupiedCount}</span>
            <span className="stat-label">已占用</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✨</span>
          <div className="stat-info">
            <span className="stat-value">{availableCount}</span>
            <span className="stat-label">空闲</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏳</span>
          <div className="stat-info">
            <span className="stat-value">{pendingAligners.length}</span>
            <span className="stat-label">待上架</span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          待上架 ({pendingAligners.length})
        </button>
        <button 
          className={`tab ${activeTab === 'stored' ? 'active' : ''}`}
          onClick={() => setActiveTab('stored')}
        >
          已上架 ({storedAligners.length})
        </button>
        <button 
          className={`tab ${activeTab === 'shelves' ? 'active' : ''}`}
          onClick={() => setActiveTab('shelves')}
        >
          柜位管理
        </button>
        <button 
          className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          盘点模式
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'pending' && (
          <div className="section-card">
            {pendingAligners.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>暂无待上架牙套</p>
              </div>
            ) : (
              <div className="aligner-grid">
                {pendingAligners.map(aligner => (
                  <div key={aligner.id} className="aligner-card pending">
                    <div className="card-header">
                      <span className="patient-name">{aligner.patientName}</span>
                      <span className="status-badge pending-status">待上架</span>
                    </div>
                    <div className="card-body">
                      <div className="info-row">
                        <span className="info-label">病例号</span>
                        <span className="info-value">{aligner.caseNumber}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">阶段</span>
                        <span className="info-value">第{aligner.stageNumber}阶段</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">副数</span>
                        <span className="info-value">{aligner.arrivedPairs} 副</span>
                      </div>
                      {aligner.needDoctorInfo && (
                        <div className="info-row warning-row">
                          <span className="warning-tag">⚠️ 待补医生信息</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="info-label">厂家</span>
                        <span className="info-value">{aligner.manufacturer}</span>
                      </div>
                    </div>
                    <div className="card-footer">
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenShelfModal(aligner)}
                      >
                        上架
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePrintLabel(aligner)}
                      >
                        打印标签
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stored' && (
          <div className="section-card">
            {storedAligners.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>暂无已上架牙套</p>
              </div>
            ) : (
              <div className="aligner-grid">
                {storedAligners.map(aligner => (
                  <div key={aligner.id} className="aligner-card stored">
                    <div className="card-header">
                      <span className="patient-name">{aligner.patientName}</span>
                      <span className="status-badge stored-status">已上架</span>
                    </div>
                    <div className="card-body">
                      <div className="info-row">
                        <span className="info-label">病例号</span>
                        <span className="info-value">{aligner.caseNumber}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">柜位</span>
                        <span className="info-value location">
                          {aligner.cabinetNumber}柜-{aligner.layerNumber}层-{aligner.cellNumber}格
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">阶段</span>
                        <span className="info-value">第{aligner.stageNumber}阶段</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">入库日期</span>
                        <span className="info-value">
                          {aligner.storedDate ? new Date(aligner.storedDate).toLocaleDateString('zh-CN') : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="card-footer">
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePrintLabel(aligner)}
                      >
                        打印标签
                      </button>
                      <button 
                        className="btn-text btn-danger"
                        onClick={() => handleRemoveAligner(aligner.id)}
                      >
                        移出
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'shelves' && (
          <div className="shelf-management">
            <div className="section-card">
              <div className="section-title">
                <span className="title-icon">➕</span>
                <h3>新增柜位</h3>
              </div>
              <form onSubmit={handleAddShelf} className="shelf-add-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>柜号</label>
                    <input
                      type="text"
                      value={newShelf.cabinetNumber}
                      onChange={e => setNewShelf(prev => ({ ...prev, cabinetNumber: e.target.value }))}
                      placeholder="如：A、B、1、2"
                    />
                  </div>
                  <div className="form-group">
                    <label>层号</label>
                    <input
                      type="text"
                      value={newShelf.layerNumber}
                      onChange={e => setNewShelf(prev => ({ ...prev, layerNumber: e.target.value }))}
                      placeholder="如：1、2、上、中"
                    />
                  </div>
                  <div className="form-group">
                    <label>格口号</label>
                    <input
                      type="text"
                      value={newShelf.cellNumber}
                      onChange={e => setNewShelf(prev => ({ ...prev, cellNumber: e.target.value }))}
                      placeholder="如：01、02、左、右"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">添加</button>
                  </div>
                </div>
              </form>
            </div>

            <div className="section-card">
              <div className="section-title">
                <span className="title-icon">🗄️</span>
                <h3>柜位分布</h3>
              </div>
              
              {cabinetNumbers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🗄️</div>
                  <p>暂无柜位，请先添加</p>
                </div>
              ) : (
                <div className="cabinet-list">
                  {cabinetNumbers.map(cabinet => {
                    const cabinetShelves = getShelvesByCabinet(cabinet);
                    const layers = [...new Set(cabinetShelves.map(s => s.layerNumber))].sort();
                    
                    return (
                      <div key={cabinet} className="cabinet-block">
                        <div className="cabinet-header">
                          <h4>{cabinet} 柜</h4>
                          <span className="cabinet-count">共 {cabinetShelves.length} 格</span>
                        </div>
                        <div className="layer-list">
                          {layers.map(layer => {
                            const layerCells = cabinetShelves.filter(s => s.layerNumber === layer).sort((a, b) => a.cellNumber.localeCompare(b.cellNumber));
                            
                            return (
                              <div key={layer} className="layer-row">
                                <div className="layer-label">{layer}层</div>
                                <div className="cell-grid">
                                  {layerCells.map(cell => {
                                    const aligner = cell.alignerId 
                                      ? alignerStore.getById(cell.alignerId) 
                                      : null;
                                    
                                    return (
                                      <div 
                                        key={cell.id} 
                                        className={`cell-item ${cell.isOccupied ? 'occupied' : 'empty'}`}
                                        title={cell.isOccupied && aligner 
                                          ? `${aligner.patientName} - 第${aligner.stageNumber}阶段`
                                          : '空闲'
                                        }
                                      >
                                        <span className="cell-number">{cell.cellNumber}</span>
                                        {cell.isOccupied && aligner && (
                                          <div className="cell-content">
                                            <span className="cell-patient">{aligner.patientName}</span>
                                            <span className="cell-stage">第{aligner.stageNumber}阶段</span>
                                          </div>
                                        )}
                                        <button
                                          className="cell-delete"
                                          onClick={() => handleRemoveShelf(cell.id)}
                                          title="删除此格"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="inventory-section">
            <div className="section-card">
              <div className="section-title">
                <span className="title-icon">📋</span>
                <h3>盘点控制</h3>
              </div>
              
              <div className="form-row" style={{ alignItems: 'flex-end' }}>
                <div className="form-group">
                  <label>选择柜号 <span className="required">*</span></label>
                  <select
                    value={inventoryCabinet}
                    onChange={e => {
                      setInventoryCabinet(e.target.value);
                      if (currentBatch) {
                        alert('请先结束当前盘点');
                      }
                    }}
                    disabled={!!currentBatch}
                  >
                    <option value="">请选择柜号</option>
                    {cabinetNumbers.map(cab => (
                      <option key={cab} value={cab}>{cab} 柜</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>盘点人 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={inventoryBy}
                    onChange={e => setInventoryBy(e.target.value)}
                    placeholder="请输入盘点人姓名"
                    disabled={!!currentBatch}
                  />
                </div>
                <div className="form-group" style={{ flex: '0 0 auto' }}>
                  {!currentBatch ? (
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      onClick={startInventory}
                    >
                      开始盘点
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        className="btn btn-danger"
                        onClick={cancelInventory}
                      >
                        取消盘点
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        onClick={endInventory}
                      >
                        结束盘点
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {currentBatch && (
              <>
                <div className="section-card">
                  <div className="section-title">
                    <span className="title-icon">📊</span>
                    <h3>盘点进度</h3>
                    <span className="badge">
                      {inventoryStats.checked}/{inventoryStats.total} 已核对
                    </span>
                  </div>
                  <div className="stats-row" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(6, 1fr)' }}>
                    <div className="stat-card" style={{ padding: '12px', gap: '8px' }}>
                      <span className="stat-icon" style={{ width: '36px', height: '36px', fontSize: '18px' }}>📦</span>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: '20px' }}>{inventoryStats.total}</span>
                        <span className="stat-label">总数</span>
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: '12px', gap: '8px' }}>
                      <span className="stat-icon" style={{ width: '36px', height: '36px', fontSize: '18px' }}>✅</span>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: '20px' }}>{inventoryStats.checked}</span>
                        <span className="stat-label">已核对</span>
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: '12px', gap: '8px', background: '#e8f5e9' }}>
                      <span className="stat-icon" style={{ width: '36px', height: '36px', fontSize: '18px', background: 'white' }}>🟢</span>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: '20px', color: '#2e7d32' }}>{inventoryStats.normal}</span>
                        <span className="stat-label" style={{ color: '#2e7d32' }}>正常</span>
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: '12px', gap: '8px', background: '#f5f5f5' }}>
                      <span className="stat-icon" style={{ width: '36px', height: '36px', fontSize: '18px', background: 'white' }}>⚪</span>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: '20px', color: '#616161' }}>{inventoryStats.empty}</span>
                        <span className="stat-label" style={{ color: '#616161' }}>空格</span>
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: '12px', gap: '8px', background: '#fff3e0' }}>
                      <span className="stat-icon" style={{ width: '36px', height: '36px', fontSize: '18px', background: 'white' }}>🟠</span>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: '20px', color: '#e65100' }}>{inventoryStats.mismatch}</span>
                        <span className="stat-label" style={{ color: '#e65100' }}>错放</span>
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: '12px', gap: '8px', background: '#ffebee' }}>
                      <span className="stat-icon" style={{ width: '36px', height: '36px', fontSize: '18px', background: 'white' }}>🔴</span>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: '20px', color: '#c62828' }}>{inventoryStats.missing}</span>
                        <span className="stat-label" style={{ color: '#c62828' }}>缺失</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-title">
                    <span className="title-icon">🏷️</span>
                    <h3>{currentBatch.cabinetNumber} 柜 - 格口核对</h3>
                  </div>
                  
                  <div className="cabinet-list">
                    {layers.map(layer => {
                      const layerCells = cellCheckStates
                        .filter(c => c.layerNumber === layer)
                        .sort((a, b) => a.cellNumber.localeCompare(b.cellNumber));
                      
                      return (
                        <div key={layer} className="layer-row" style={{ marginBottom: '24px' }}>
                          <div className="layer-label">{layer}层</div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {layerCells.map(cell => {
                              const colors = getStatusColor(cell.status);
                              return (
                                <div 
                                  key={cell.shelfId}
                                  className={`border-2 rounded-lg p-4 transition-all ${colors.bg} ${colors.border}`}
                                  style={{ borderStyle: cell.isChecked ? 'solid' : 'dashed' }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                        <span style={{ fontWeight: '600', fontSize: '16px' }}>
                                          {cell.layerNumber}层-{cell.cellNumber}格
                                        </span>
                                        {!cell.isChecked && (
                                          <span className="badge" style={{ background: '#fff3e0', color: '#f57f17' }}>
                                            待核对
                                          </span>
                                        )}
                                        {cell.isChecked && cell.status && (
                                          <span className="badge" style={getStatusBadgeStyle(cell.status)}>
                                            {getStatusText(cell.status)}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {cell.expectedAligner ? (
                                        <div style={{ background: 'white', padding: '12px', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
                                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>系统记录（应存）</div>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                            <div>
                                              <span className="info-label">患者姓名</span>
                                              <div className="info-value">{cell.expectedAligner.patientName}</div>
                                            </div>
                                            <div>
                                              <span className="info-label">病例号</span>
                                              <div className="info-value">{cell.expectedAligner.caseNumber}</div>
                                            </div>
                                            <div>
                                              <span className="info-label">阶段</span>
                                              <div className="info-value">第{cell.expectedAligner.stageNumber}阶段</div>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '12px', border: '1px dashed #ccc' }}>
                                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>系统记录：空格（无存放记录）</div>
                                        </div>
                                      )}

                                      {!cell.isChecked && (
                                        <>
                                          <div style={{ marginBottom: '12px' }}>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                                              核对结果 <span className="required">*</span>
                                            </label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                              {(['normal', 'empty', 'mismatch', 'missing'] as InventoryStatus[]).map(status => (
                                                <label key={status} style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: '4px', 
                                                  padding: '6px 12px', 
                                                  border: '1px solid var(--border-color)', 
                                                  borderRadius: '6px', 
                                                  cursor: 'pointer',
                                                  background: cell.status === status ? getStatusBadgeStyle(status).background : 'white',
                                                  color: cell.status === status ? getStatusBadgeStyle(status).color : 'var(--text-primary)'
                                                }}>
                                                  <input 
                                                    type="radio" 
                                                    name={`status-${cell.shelfId}`}
                                                    checked={cell.status === status}
                                                    onChange={() => handleCellStatusChange(cell.shelfId, status)}
                                                    style={{ cursor: 'pointer' }}
                                                  />
                                                  {getStatusText(status)}
                                                </label>
                                              ))}
                                            </div>
                                          </div>

                                          {cell.status === 'mismatch' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>实际患者姓名</label>
                                                <input
                                                  type="text"
                                                  value={cell.actualPatientName}
                                                  onChange={e => handleCellActualPatientChange(cell.shelfId, 'patientName', e.target.value)}
                                                  placeholder="请输入实际患者姓名"
                                                />
                                              </div>
                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>实际病例号</label>
                                                <input
                                                  type="text"
                                                  value={cell.actualCaseNumber}
                                                  onChange={e => handleCellActualPatientChange(cell.shelfId, 'caseNumber', e.target.value)}
                                                  placeholder="请输入实际病例号"
                                                />
                                              </div>
                                            </div>
                                          )}

                                          <div style={{ marginBottom: '12px' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                              <label>备注</label>
                                              <textarea
                                                value={cell.remark}
                                                onChange={e => handleCellRemarkChange(cell.shelfId, e.target.value)}
                                                placeholder="请输入备注信息（可选）"
                                                rows={2}
                                              />
                                            </div>
                                          </div>

                                          <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => confirmCellCheck(cell.shelfId)}
                                          >
                                            确认核对
                                          </button>
                                        </>
                                      )}

                                      {cell.isChecked && (
                                        <div style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                          {cell.status === 'mismatch' && (
                                            <div style={{ marginBottom: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                              <div>
                                                <span className="info-label">实际患者</span>
                                                <div className="info-value">{cell.actualPatientName || '-'}</div>
                                              </div>
                                              <div>
                                                <span className="info-label">实际病例号</span>
                                                <div className="info-value">{cell.actualCaseNumber || '-'}</div>
                                              </div>
                                            </div>
                                          )}
                                          {cell.remark && (
                                            <div>
                                              <span className="info-label">备注</span>
                                              <div className="info-value">{cell.remark}</div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {!currentBatch && inventoryCabinet && (
              <div className="section-card">
                <div className="section-title">
                  <span className="title-icon">📜</span>
                  <h3>{inventoryCabinet} 柜 - 盘点历史</h3>
                </div>
                
                {inventoryHistory.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📜</div>
                    <p>暂无盘点历史记录</p>
                  </div>
                ) : (
                  <div className="records-table-wrapper">
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>盘点时间</th>
                          <th>盘点人</th>
                          <th>总格口数</th>
                          <th>正常</th>
                          <th>空格</th>
                          <th>错放</th>
                          <th>缺失</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryHistory.map(batch => (
                          <tr key={batch.id}>
                            <td>{new Date(batch.inventoryDate).toLocaleString('zh-CN')}</td>
                            <td>{batch.inventoryBy}</td>
                            <td>{batch.totalCount}</td>
                            <td style={{ color: '#2e7d32', fontWeight: '500' }}>{batch.normalCount}</td>
                            <td style={{ color: '#616161', fontWeight: '500' }}>{batch.emptyCount}</td>
                            <td style={{ color: '#e65100', fontWeight: '500' }}>{batch.mismatchCount}</td>
                            <td style={{ color: '#c62828', fontWeight: '500' }}>{batch.missingCount}</td>
                            <td>
                              <button
                                className="btn-text"
                                onClick={() => viewHistoryDetail(batch)}
                              >
                                查看明细
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!currentBatch && !inventoryCabinet && (
              <div className="section-card">
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <p>请选择柜号开始盘点或查看历史记录</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showShelfModal && selectedAligner && (
        <div className="modal-overlay" onClick={() => setShowShelfModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>牙套上架</h3>
              <button className="close-btn" onClick={() => setShowShelfModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="aligner-summary">
                <p><strong>患者：</strong>{selectedAligner.patientName}</p>
                <p><strong>病例号：</strong>{selectedAligner.caseNumber}</p>
                <p><strong>阶段：</strong>第{selectedAligner.stageNumber}阶段</p>
              </div>
              
              <form onSubmit={handleShelfSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>柜号 <span className="required">*</span></label>
                    <input
                      type="text"
                      value={shelfForm.cabinetNumber}
                      onChange={e => setShelfForm(prev => ({ ...prev, cabinetNumber: e.target.value }))}
                      placeholder="如：A、B"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>层号 <span className="required">*</span></label>
                    <input
                      type="text"
                      value={shelfForm.layerNumber}
                      onChange={e => setShelfForm(prev => ({ ...prev, layerNumber: e.target.value }))}
                      placeholder="如：1、2"
                    />
                  </div>
                  <div className="form-group">
                    <label>格口 <span className="required">*</span></label>
                    <input
                      type="text"
                      value={shelfForm.cellNumber}
                      onChange={e => setShelfForm(prev => ({ ...prev, cellNumber: e.target.value }))}
                      placeholder="如：01、02"
                    />
                  </div>
                </div>
                
                <p className="form-hint">
                  提示：如果柜位不存在，系统会自动创建
                </p>
                
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowShelfModal(false)}
                  >
                    取消
                  </button>
                  <button type="submit" className="btn btn-primary">
                    确认上架
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showLabelModal && labelAligner && (
        <LabelPrintModal
          aligner={labelAligner}
          onClose={() => {
            setShowLabelModal(false);
            setLabelAligner(null);
          }}
        />
      )}

      {showHistoryModal && selectedHistoryBatch && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>盘点明细 - {selectedHistoryBatch.cabinetNumber}柜</h3>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>盘点时间</div>
                    <div style={{ fontWeight: '500' }}>{new Date(selectedHistoryBatch.inventoryDate).toLocaleString('zh-CN')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>盘点人</div>
                    <div style={{ fontWeight: '500' }}>{selectedHistoryBatch.inventoryBy}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>总格口数</div>
                    <div style={{ fontWeight: '500' }}>{selectedHistoryBatch.totalCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>状态</div>
                    <div style={{ fontWeight: '500', color: '#2e7d32' }}>已完成</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ color: '#2e7d32' }}>
                    <div style={{ fontSize: '12px' }}>正常</div>
                    <div style={{ fontWeight: '600', fontSize: '18px' }}>{selectedHistoryBatch.normalCount}</div>
                  </div>
                  <div style={{ color: '#616161' }}>
                    <div style={{ fontSize: '12px' }}>空格</div>
                    <div style={{ fontWeight: '600', fontSize: '18px' }}>{selectedHistoryBatch.emptyCount}</div>
                  </div>
                  <div style={{ color: '#e65100' }}>
                    <div style={{ fontSize: '12px' }}>错放</div>
                    <div style={{ fontWeight: '600', fontSize: '18px' }}>{selectedHistoryBatch.mismatchCount}</div>
                  </div>
                  <div style={{ color: '#c62828' }}>
                    <div style={{ fontSize: '12px' }}>缺失</div>
                    <div style={{ fontWeight: '600', fontSize: '18px' }}>{selectedHistoryBatch.missingCount}</div>
                  </div>
                </div>
              </div>

              <div className="records-table-wrapper">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>位置</th>
                      <th>状态</th>
                      <th>系统记录 - 患者</th>
                      <th>系统记录 - 病例号</th>
                      <th>系统记录 - 阶段</th>
                      <th>实际患者</th>
                      <th>实际病例号</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map(record => {
                      const colors = getStatusColor(record.status);
                      return (
                        <tr key={record.id} style={{ background: colors.bg }}>
                          <td style={{ fontWeight: '500' }}>
                            {record.layerNumber}层-{record.cellNumber}格
                          </td>
                          <td>
                            <span className="badge" style={getStatusBadgeStyle(record.status)}>
                              {getStatusText(record.status)}
                            </span>
                          </td>
                          <td>{record.expectedPatientName || '-'}</td>
                          <td>{record.expectedCaseNumber || '-'}</td>
                          <td>{record.expectedStageNumber ? `第${record.expectedStageNumber}阶段` : '-'}</td>
                          <td>{record.actualPatientName || '-'}</td>
                          <td>{record.actualCaseNumber || '-'}</td>
                          <td className="remark-cell">{record.remark || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowHistoryModal(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .warning-row {
          margin-top: 4px;
          margin-bottom: 4px;
        }
        
        .warning-tag {
          display: inline-block;
          padding: 3px 10px;
          background: #fff3e0;
          color: #e65100;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid #ffcc80;
        }
      `}</style>
    </div>
  );
}

export default ShelfPage;
