import { useState, useEffect } from 'react';
import { shelfStore, alignerStore } from '../store';
import type { Shelf, Aligner } from '../types';
import LabelPrintModal from '../components/LabelPrintModal';

interface ShelfPageProps {
  onShelfChange?: () => void;
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

  const [activeTab, setActiveTab] = useState<'pending' | 'stored' | 'shelves'>('pending');

  useEffect(() => {
    loadData();
  }, []);

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
    </div>
  );
}

export default ShelfPage;
