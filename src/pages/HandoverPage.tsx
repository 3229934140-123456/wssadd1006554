import { useState, useEffect } from 'react';
import { alignerStore, handoverStore, shelfStore } from '../store';
import type { Aligner, HandoverRecord, HandoverPurpose } from '../types';

interface HandoverPageProps {
  onHandoverChange?: () => void;
}

function HandoverPage({ onHandoverChange }: HandoverPageProps) {
  const [storedAligners, setStoredAligners] = useState<Aligner[]>([]);
  const [handoverRecords, setHandoverRecords] = useState<HandoverRecord[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [selectedAligner, setSelectedAligner] = useState<Aligner | null>(null);
  const [activeTab, setActiveTab] = useState<'handover' | 'history'>('handover');
  
  const [handoverForm, setHandoverForm] = useState({
    receiver: '',
    receiverRole: '护士',
    pairsTaken: '',
    purpose: 'chairside_check' as HandoverPurpose,
    remark: '',
    operator: '',
  });

  const [filterPurpose, setFilterPurpose] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const stored = alignerStore.getStoredList();
    setStoredAligners(stored);
    const records = handoverStore.getAll();
    setHandoverRecords(
      records.sort((a, b) => 
        new Date(b.handoverDate).getTime() - new Date(a.handoverDate).getTime()
      )
    );
  };

  const filteredAligners = storedAligners.filter(a =>
    a.patientName.includes(searchKeyword) ||
    a.caseNumber.includes(searchKeyword) ||
    a.stageNumber.includes(searchKeyword)
  );

  const filteredRecords = handoverRecords.filter(r => {
    if (filterPurpose !== 'all' && r.purpose !== filterPurpose) {
      return false;
    }
    if (searchKeyword) {
      return (
        r.patientName.includes(searchKeyword) ||
        r.caseNumber.includes(searchKeyword) ||
        r.receiver.includes(searchKeyword)
      );
    }
    return true;
  });

  const handleOpenHandover = (aligner: Aligner) => {
    setSelectedAligner(aligner);
    setHandoverForm({
      receiver: '',
      receiverRole: '护士',
      pairsTaken: aligner.arrivedPairs.toString(),
      purpose: 'chairside_check',
      remark: '',
      operator: '',
    });
    setShowHandoverModal(true);
  };

  const handleHandoverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAligner) return;

    if (!handoverForm.receiver.trim()) {
      alert('请填写领取人姓名');
      return;
    }

    const pairsTaken = parseInt(handoverForm.pairsTaken);
    if (isNaN(pairsTaken) || pairsTaken <= 0) {
      alert('请填写有效的领取副数');
      return;
    }

    if (pairsTaken > selectedAligner.arrivedPairs) {
      alert(`领取副数不能超过库存（${selectedAligner.arrivedPairs}副）`);
      return;
    }

    handoverStore.create({
      alignerId: selectedAligner.id,
      patientName: selectedAligner.patientName,
      caseNumber: selectedAligner.caseNumber,
      receiver: handoverForm.receiver.trim(),
      receiverRole: handoverForm.receiverRole,
      pairsTaken,
      purpose: handoverForm.purpose,
      handoverDate: new Date().toISOString(),
      remark: handoverForm.remark.trim() || undefined,
      operator: handoverForm.operator.trim() || '管理员',
    });

    if (handoverForm.purpose === 'return' || handoverForm.purpose === 'damage') {
      if (pairsTaken >= selectedAligner.arrivedPairs) {
        alignerStore.update(selectedAligner.id, {
          status: handoverForm.purpose === 'damage' ? 'damaged' : 'returned',
        });
      }
    } else {
      if (pairsTaken >= selectedAligner.arrivedPairs) {
        alignerStore.update(selectedAligner.id, {
          status: 'handed_over',
        });
      }
    }

    const remainingPairs = selectedAligner.arrivedPairs - pairsTaken;
    if (remainingPairs > 0) {
      alignerStore.update(selectedAligner.id, {
        arrivedPairs: remainingPairs,
      });
    } else if (selectedAligner.shelfId) {
      shelfStore.update(selectedAligner.shelfId, {
        isOccupied: false,
        alignerId: undefined,
      });
    }

    setShowHandoverModal(false);
    setSelectedAligner(null);
    loadData();
    onHandoverChange?.();
  };

  const getPurposeLabel = (purpose: HandoverPurpose) => {
    const labels: Record<HandoverPurpose, string> = {
      clinic_delivery: '当场发放',
      chairside_check: '诊室检查',
      return: '退回',
      reissue: '补发',
      damage: '包装损坏',
    };
    return labels[purpose];
  };

  const getPurposeClass = (purpose: HandoverPurpose) => {
    const classes: Record<HandoverPurpose, string> = {
      clinic_delivery: 'purpose-delivery',
      chairside_check: 'purpose-check',
      return: 'purpose-return',
      reissue: 'purpose-reissue',
      damage: 'purpose-damage',
    };
    return classes[purpose];
  };

  const purposeOptions = [
    { value: 'chairside_check', label: '诊室检查', icon: '🏥' },
    { value: 'clinic_delivery', label: '当场发放', icon: '🤝' },
    { value: 'return', label: '退回', icon: '↩️' },
    { value: 'reissue', label: '补发', icon: '📤' },
    { value: 'damage', label: '包装损坏', icon: '⚠️' },
  ];

  return (
    <div className="handover-page">
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="搜索患者姓名、病例号..."
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
        />
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'handover' ? 'active' : ''}`}
          onClick={() => setActiveTab('handover')}
        >
          领取登记 ({filteredAligners.length})
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          交接记录 ({filteredRecords.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'handover' && (
          <div className="section-card">
            {filteredAligners.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>{searchKeyword ? '未找到匹配的牙套' : '暂无可领取的牙套'}</p>
              </div>
            ) : (
              <div className="handover-list">
                {filteredAligners.map(aligner => (
                  <div key={aligner.id} className="handover-item">
                    <div className="handover-info">
                      <div className="patient-row">
                        <span className="patient-name">{aligner.patientName}</span>
                        <span className="case-number">{aligner.caseNumber}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-item">
                          第{aligner.stageNumber}阶段
                        </span>
                        <span className="detail-item">
                          库存：{aligner.arrivedPairs}副
                        </span>
                        <span className="detail-item location">
                          {aligner.cabinetNumber}柜-{aligner.layerNumber}层-{aligner.cellNumber}格
                        </span>
                      </div>
                    </div>
                    <div className="handover-action">
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleOpenHandover(aligner)}
                      >
                        交接登记
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="section-card">
            <div className="filter-bar">
              <span className="filter-label">用途筛选：</span>
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${filterPurpose === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterPurpose('all')}
                >
                  全部
                </button>
                {purposeOptions.map(opt => (
                  <button
                    key={opt.value}
                    className={`filter-btn ${filterPurpose === opt.value ? 'active' : ''}`}
                    onClick={() => setFilterPurpose(opt.value)}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>暂无交接记录</p>
              </div>
            ) : (
              <div className="records-table-wrapper">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>患者</th>
                      <th>病例号</th>
                      <th>领取人</th>
                      <th>副数</th>
                      <th>用途</th>
                      <th>操作员</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(record => (
                      <tr key={record.id}>
                        <td>
                          {new Date(record.handoverDate).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="patient-cell">{record.patientName}</td>
                        <td>{record.caseNumber}</td>
                        <td>{record.receiver} ({record.receiverRole})</td>
                        <td>{record.pairsTaken}副</td>
                        <td>
                          <span className={`purpose-tag ${getPurposeClass(record.purpose)}`}>
                            {getPurposeLabel(record.purpose)}
                          </span>
                        </td>
                        <td>{record.operator}</td>
                        <td className="remark-cell">{record.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showHandoverModal && selectedAligner && (
        <div className="modal-overlay" onClick={() => setShowHandoverModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>交接登记</h3>
              <button className="close-btn" onClick={() => setShowHandoverModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="aligner-summary">
                <div className="summary-grid">
                  <div>
                    <span className="summary-label">患者</span>
                    <span className="summary-value">{selectedAligner.patientName}</span>
                  </div>
                  <div>
                    <span className="summary-label">病例号</span>
                    <span className="summary-value">{selectedAligner.caseNumber}</span>
                  </div>
                  <div>
                    <span className="summary-label">阶段</span>
                    <span className="summary-value">第{selectedAligner.stageNumber}阶段</span>
                  </div>
                  <div>
                    <span className="summary-label">库存</span>
                    <span className="summary-value highlight">{selectedAligner.arrivedPairs}副</span>
                  </div>
                  <div>
                    <span className="summary-label">柜位</span>
                    <span className="summary-value">
                      {selectedAligner.cabinetNumber}柜-{selectedAligner.layerNumber}层-{selectedAligner.cellNumber}格
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleHandoverSubmit}>
                <div className="form-group">
                  <label>领取人 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={handoverForm.receiver}
                    onChange={e => setHandoverForm(prev => ({ ...prev, receiver: e.target.value }))}
                    placeholder="请输入领取人姓名"
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>身份</label>
                    <select
                      value={handoverForm.receiverRole}
                      onChange={e => setHandoverForm(prev => ({ ...prev, receiverRole: e.target.value }))}
                    >
                      <option value="护士">护士</option>
                      <option value="医生">医生</option>
                      <option value="前台">前台</option>
                      <option value="患者">患者</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>领取副数 <span className="required">*</span></label>
                    <input
                      type="number"
                      value={handoverForm.pairsTaken}
                      onChange={e => setHandoverForm(prev => ({ ...prev, pairsTaken: e.target.value }))}
                      min="1"
                      max={selectedAligner.arrivedPairs}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>用途 <span className="required">*</span></label>
                  <div className="purpose-options">
                    {purposeOptions.map(opt => (
                      <label 
                        key={opt.value}
                        className={`purpose-option ${handoverForm.purpose === opt.value ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="purpose"
                          value={opt.value}
                          checked={handoverForm.purpose === opt.value}
                          onChange={e => setHandoverForm(prev => ({ 
                            ...prev, 
                            purpose: e.target.value as HandoverPurpose 
                          }))}
                        />
                        <span className="purpose-icon">{opt.icon}</span>
                        <span className="purpose-text">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>操作员</label>
                  <input
                    type="text"
                    value={handoverForm.operator}
                    onChange={e => setHandoverForm(prev => ({ ...prev, operator: e.target.value }))}
                    placeholder="默认为管理员"
                  />
                </div>

                <div className="form-group">
                  <label>备注</label>
                  <textarea
                    value={handoverForm.remark}
                    onChange={e => setHandoverForm(prev => ({ ...prev, remark: e.target.value }))}
                    placeholder="特殊情况说明"
                    rows={2}
                  />
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowHandoverModal(false)}
                  >
                    取消
                  </button>
                  <button type="submit" className="btn btn-primary">
                    确认交接
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HandoverPage;
