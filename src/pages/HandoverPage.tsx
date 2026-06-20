import { useState, useEffect, useMemo } from 'react';
import { alignerStore, handoverStore, shelfStore } from '../store';
import type { Aligner, HandoverRecord, HandoverPurpose } from '../types';

interface HandoverPageProps {
  onHandoverChange?: () => void;
}

interface BatchSelection {
  alignerId: string;
  pairsTaken: number;
}

interface PatientGroup {
  patientName: string;
  caseNumber: string;
  aligners: Aligner[];
}

interface CollapsedGroup {
  [key: string]: boolean;
}

function HandoverPage({ onHandoverChange }: HandoverPageProps) {
  const [storedAligners, setStoredAligners] = useState<Aligner[]>([]);
  const [handoverRecords, setHandoverRecords] = useState<HandoverRecord[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedAligner, setSelectedAligner] = useState<Aligner | null>(null);
  const [activeTab, setActiveTab] = useState<'handover' | 'history'>('handover');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchSelections, setBatchSelections] = useState<BatchSelection[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedGroup>({});
  const [collapsedRecordGroups, setCollapsedRecordGroups] = useState<CollapsedGroup>({});
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokingRecord, setRevokingRecord] = useState<HandoverRecord | null>(null);
  const [revokeForm, setRevokeForm] = useState({
    reason: '',
    operator: '管理员',
  });

  const [handoverForm, setHandoverForm] = useState({
    receiver: '',
    receiverRole: '护士',
    pairsTaken: '',
    purpose: 'chairside_check' as HandoverPurpose,
    remark: '',
    operator: '',
  });

  const [batchForm, setBatchForm] = useState({
    receiver: '',
    receiverRole: '护士',
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

  const patientGroups = useMemo<PatientGroup[]>(() => {
    const groups: { [key: string]: PatientGroup } = {};
    filteredAligners.forEach(aligner => {
      const key = `${aligner.patientName}-${aligner.caseNumber}`;
      if (!groups[key]) {
        groups[key] = {
          patientName: aligner.patientName,
          caseNumber: aligner.caseNumber,
          aligners: [],
        };
      }
      groups[key].aligners.push(aligner);
    });
    return Object.values(groups).sort((a, b) => a.patientName.localeCompare(b.patientName));
  }, [filteredAligners]);

  const patientOtherStages = useMemo(() => {
    if (!selectedAligner) return [];
    return storedAligners.filter(a => 
      a.caseNumber === selectedAligner.caseNumber && a.id !== selectedAligner.id
    );
  }, [selectedAligner, storedAligners]);

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

  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: HandoverRecord[] } = {};
    filteredRecords.forEach(record => {
      const date = new Date(record.handoverDate);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      const key = `${dateKey}-${record.receiver}-${record.receiverRole}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    });
    return Object.entries(groups).map(([key, records]) => ({
      key,
      records,
      isBatch: records.length > 1,
    }));
  }, [filteredRecords]);

  const selectedCount = batchSelections.length;
  const totalPairs = batchSelections.reduce((sum, s) => sum + s.pairsTaken, 0);

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

  const handleToggleSelect = (aligner: Aligner) => {
    setBatchSelections(prev => {
      const exists = prev.find(s => s.alignerId === aligner.id);
      if (exists) {
        return prev.filter(s => s.alignerId !== aligner.id);
      }
      return [...prev, { alignerId: aligner.id, pairsTaken: aligner.arrivedPairs }];
    });
  };

  const handleSelectAllForPatient = (group: PatientGroup) => {
    const allSelected = group.aligners.every(a => 
      batchSelections.some(s => s.alignerId === a.id)
    );
    
    if (allSelected) {
      setBatchSelections(prev => 
        prev.filter(s => !group.aligners.some(a => a.id === s.alignerId))
      );
    } else {
      setBatchSelections(prev => {
        const newSelections = [...prev];
        group.aligners.forEach(aligner => {
          if (!newSelections.some(s => s.alignerId === aligner.id)) {
            newSelections.push({ alignerId: aligner.id, pairsTaken: aligner.arrivedPairs });
          }
        });
        return newSelections;
      });
    }
  };

  const handleClearSelections = () => {
    setBatchSelections([]);
  };

  const handleUpdatePairsTaken = (alignerId: string, pairs: number) => {
    setBatchSelections(prev =>
      prev.map(s => s.alignerId === alignerId ? { ...s, pairsTaken: pairs } : s)
    );
  };

  const handleOpenBatchModal = () => {
    if (batchSelections.length === 0) {
      alert('请先选择要交接的牙套');
      return;
    }
    setBatchForm({
      receiver: '',
      receiverRole: '护士',
      purpose: 'chairside_check',
      remark: '',
      operator: '',
    });
    setShowBatchModal(true);
  };

  const isSelected = (alignerId: string) => {
    return batchSelections.some(s => s.alignerId === alignerId);
  };

  const isPatientAllSelected = (group: PatientGroup) => {
    return group.aligners.every(a => batchSelections.some(s => s.alignerId === a.id));
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleRecordGroupCollapse = (key: string) => {
    setCollapsedRecordGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getSelectedAligner = (alignerId: string) => {
    return storedAligners.find(a => a.id === alignerId);
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

    updateAlignerAfterHandover(selectedAligner, pairsTaken, handoverForm.purpose);

    setShowHandoverModal(false);
    setSelectedAligner(null);
    loadData();
    onHandoverChange?.();
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchForm.receiver.trim()) {
      alert('请填写领取人姓名');
      return;
    }

    for (const selection of batchSelections) {
      const aligner = getSelectedAligner(selection.alignerId);
      if (!aligner) continue;

      if (selection.pairsTaken <= 0 || selection.pairsTaken > aligner.arrivedPairs) {
        alert(`${aligner.patientName} 第${aligner.stageNumber}阶段的领取副数无效`);
        return;
      }
    }

    const now = new Date().toISOString();

    for (const selection of batchSelections) {
      const aligner = getSelectedAligner(selection.alignerId);
      if (!aligner) continue;

      handoverStore.create({
        alignerId: aligner.id,
        patientName: aligner.patientName,
        caseNumber: aligner.caseNumber,
        receiver: batchForm.receiver.trim(),
        receiverRole: batchForm.receiverRole,
        pairsTaken: selection.pairsTaken,
        purpose: batchForm.purpose,
        handoverDate: now,
        remark: batchForm.remark.trim() || undefined,
        operator: batchForm.operator.trim() || '管理员',
      });

      updateAlignerAfterHandover(aligner, selection.pairsTaken, batchForm.purpose);
    }

    setShowBatchModal(false);
    setBatchSelections([]);
    loadData();
    onHandoverChange?.();
  };

  const updateAlignerAfterHandover = (aligner: Aligner, pairsTaken: number, purpose: HandoverPurpose) => {
    if (purpose === 'return' || purpose === 'damage') {
      if (pairsTaken >= aligner.arrivedPairs) {
        alignerStore.update(aligner.id, {
          status: purpose === 'damage' ? 'damaged' : 'returned',
        });
      }
    } else {
      if (pairsTaken >= aligner.arrivedPairs) {
        alignerStore.update(aligner.id, {
          status: 'handed_over',
        });
      }
    }

    const remainingPairs = aligner.arrivedPairs - pairsTaken;
    if (remainingPairs > 0) {
      alignerStore.update(aligner.id, {
        arrivedPairs: remainingPairs,
      });
    } else if (aligner.shelfId) {
      shelfStore.update(aligner.shelfId, {
        isOccupied: false,
        alignerId: undefined,
      });
    }
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

  const handleOpenRevokeModal = (record: HandoverRecord) => {
    setRevokingRecord(record);
    setRevokeForm({
      reason: '',
      operator: '管理员',
    });
    setShowRevokeModal(true);
  };

  const handleRevokeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!revokingRecord) return;

    if (!revokeForm.reason.trim() || revokeForm.reason.trim().length < 5) {
      alert('请填写撤销原因（至少5个字）');
      return;
    }

    const operator = revokeForm.operator.trim() || '管理员';

    handoverStore.revoke(
      revokingRecord.id,
      revokeForm.reason.trim(),
      operator
    );

    setShowRevokeModal(false);
    setRevokingRecord(null);
    loadData();
    onHandoverChange?.();
    alert('撤销成功');
  };

  const purposeOptions = [
    { value: 'chairside_check', label: '诊室检查', icon: '🏥' },
    { value: 'clinic_delivery', label: '当场发放', icon: '🤝' },
    { value: 'return', label: '退回', icon: '↩️' },
    { value: 'reissue', label: '补发', icon: '📤' },
    { value: 'damage', label: '包装损坏', icon: '⚠️' },
  ];

  const roleOptions = ['护士', '医生', '前台', '患者', '其他'];

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
            <div className="mode-toggle-bar">
              <div className="mode-buttons">
                <button
                  className={`mode-btn ${!isBatchMode ? 'active' : ''}`}
                  onClick={() => {
                    setIsBatchMode(false);
                    setBatchSelections([]);
                  }}
                >
                  单个领取
                </button>
                <button
                  className={`mode-btn ${isBatchMode ? 'active' : ''}`}
                  onClick={() => setIsBatchMode(true)}
                >
                  批量领取
                </button>
              </div>
              {isBatchMode && (
                <div className="batch-actions-bar">
                  <span className="selection-count">
                    已选 <strong>{selectedCount}</strong> 项，共 <strong>{totalPairs}</strong> 副
                  </span>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearSelections}
                  >
                    清空选择
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm"
                    onClick={handleOpenBatchModal}
                    disabled={selectedCount === 0}
                  >
                    批量交接
                  </button>
                </div>
              )}
            </div>

            {filteredAligners.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>{searchKeyword ? '未找到匹配的牙套' : '暂无可领取的牙套'}</p>
              </div>
            ) : isBatchMode ? (
              <div className="batch-handover-list">
                {patientGroups.map(group => {
                  const groupKey = `${group.patientName}-${group.caseNumber}`;
                  const isCollapsed = collapsedGroups[groupKey];
                  return (
                    <div key={groupKey} className="patient-group">
                      <div className="patient-group-header">
                        <div className="patient-group-info">
                          <input
                            type="checkbox"
                            className="group-checkbox"
                            checked={isPatientAllSelected(group)}
                            onChange={() => handleSelectAllForPatient(group)}
                          />
                          <span 
                            className="patient-group-title"
                            onClick={() => toggleGroupCollapse(groupKey)}
                          >
                            {group.patientName}
                            <span className="case-number">{group.caseNumber}</span>
                            <span className="stage-count">{group.aligners.length}个阶段</span>
                            <span className="collapse-icon">{isCollapsed ? '展开 ▼' : '收起 ▲'}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSelectAllForPatient(group)}
                        >
                          {isPatientAllSelected(group) ? '取消全选' : '全选该患者'}
                        </button>
                      </div>
                      {!isCollapsed && (
                        <div className="patient-group-content">
                          {group.aligners.map(aligner => (
                            <div key={aligner.id} className={`handover-item ${isSelected(aligner.id) ? 'selected' : ''}`}>
                              <div className="handover-checkbox">
                                <input
                                  type="checkbox"
                                  checked={isSelected(aligner.id)}
                                  onChange={() => handleToggleSelect(aligner)}
                                />
                              </div>
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
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleOpenHandover(aligner)}
                                >
                                  单个交接
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                      <th>批量标记</th>
                      <th>日期</th>
                      <th>患者</th>
                      <th>病例号</th>
                      <th>领取人</th>
                      <th>副数</th>
                      <th>用途</th>
                      <th>操作员</th>
                      <th>备注</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRecords.map(({ key, records, isBatch }) => {
                      const isCollapsed = collapsedRecordGroups[key];
                      const firstRecord = records[0];
                      const totalPairsInGroup = records.reduce((sum, r) => sum + r.pairsTaken, 0);
                      const groupRevokedCount = records.filter(r => r.isRevoked).length;
                      
                      if (isBatch) {
                        return (
                          <>
                            <tr key={key} className={`record-group-header ${groupRevokedCount === records.length ? 'revoked-row' : ''}`} onClick={() => toggleRecordGroupCollapse(key)}>
                              <td>
                                <span className="batch-tag">{isCollapsed ? '▶' : '▼'} 批量</span>
                                {groupRevokedCount > 0 && groupRevokedCount < records.length && (
                                  <span className="partial-revoked-tag">部分撤销</span>
                                )}
                                {groupRevokedCount === records.length && (
                                  <span className="revoked-tag">已撤销</span>
                                )}
                              </td>
                              <td>
                                {new Date(firstRecord.handoverDate).toLocaleString('zh-CN', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td colSpan={2} className="patient-cell">
                                {records.length}位患者
                              </td>
                              <td>{firstRecord.receiver} ({firstRecord.receiverRole})</td>
                              <td>{totalPairsInGroup}副</td>
                              <td>
                                <span className={`purpose-tag ${getPurposeClass(firstRecord.purpose)}`}>
                                  {getPurposeLabel(firstRecord.purpose)}
                                </span>
                              </td>
                              <td>{firstRecord.operator}</td>
                              <td className="remark-cell">{firstRecord.remark || '-'}</td>
                              <td></td>
                            </tr>
                            {!isCollapsed && records.map(record => (
                              <tr key={record.id} className={`record-group-item ${record.isRevoked ? 'revoked-row' : ''}`}>
                                <td>
                                  <span className="batch-sub-tag">└</span>
                                  {record.isRevoked && <span className="revoked-tag">已撤销</span>}
                                </td>
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
                                <td className="remark-cell">
                                  <div>{record.remark || '-'}</div>
                                  {record.isRevoked && (
                                    <div className="revoke-info">
                                      <div>撤销原因：{record.revokeReason}</div>
                                      <div>撤销人：{record.revokedBy}</div>
                                      <div>撤销时间：{record.revokedAt ? new Date(record.revokedAt).toLocaleString('zh-CN') : '-'}</div>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {!record.isRevoked && (
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenRevokeModal(record);
                                      }}
                                    >
                                      撤销
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </>
                        );
                      }
                      
                      const record = records[0];
                      return (
                        <tr key={record.id} className={record.isRevoked ? 'revoked-row' : ''}>
                          <td>
                            <span className="single-tag">单个</span>
                            {record.isRevoked && <span className="revoked-tag">已撤销</span>}
                          </td>
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
                          <td className="remark-cell">
                            <div>{record.remark || '-'}</div>
                            {record.isRevoked && (
                              <div className="revoke-info">
                                <div>撤销原因：{record.revokeReason}</div>
                                <div>撤销人：{record.revokedBy}</div>
                                <div>撤销时间：{record.revokedAt ? new Date(record.revokedAt).toLocaleString('zh-CN') : '-'}</div>
                              </div>
                            )}
                          </td>
                          <td>
                            {!record.isRevoked && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleOpenRevokeModal(record)}
                              >
                                撤销
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showHandoverModal && selectedAligner && (
        <div className="modal-overlay" onClick={() => setShowHandoverModal(false)}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
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

              {patientOtherStages.length > 0 && (
                <div className="other-stages-section">
                  <div className="other-stages-header">
                    <span className="other-stages-title">该患者其他阶段牙套</span>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => {
                        setShowHandoverModal(false);
                        setIsBatchMode(true);
                        const newSelections: BatchSelection[] = [
                          { alignerId: selectedAligner.id, pairsTaken: selectedAligner.arrivedPairs },
                          ...patientOtherStages.map(a => ({ alignerId: a.id, pairsTaken: a.arrivedPairs }))
                        ];
                        setBatchSelections(newSelections);
                      }}
                    >
                      一键添加到批量领取
                    </button>
                  </div>
                  <div className="other-stages-list">
                    {patientOtherStages.map(a => (
                      <span key={a.id} className="stage-tag">
                        第{a.stageNumber}阶段（{a.arrivedPairs}副）
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                      {roleOptions.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
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

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>批量交接登记</h3>
              <button className="close-btn" onClick={() => setShowBatchModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="batch-summary-bar">
                <span className="batch-summary-item">
                  已选 <strong>{selectedCount}</strong> 项
                </span>
                <span className="batch-summary-item">
                  总计 <strong className="highlight">{totalPairs}</strong> 副
                </span>
              </div>

              <div className="batch-items-list">
                <h4>已选牙套清单</h4>
                <table className="batch-items-table">
                  <thead>
                    <tr>
                      <th>患者</th>
                      <th>病例号</th>
                      <th>阶段</th>
                      <th>库存</th>
                      <th>位置</th>
                      <th>领取副数 <span className="required">*</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchSelections.map(selection => {
                      const aligner = getSelectedAligner(selection.alignerId);
                      if (!aligner) return null;
                      return (
                        <tr key={aligner.id}>
                          <td className="patient-cell">{aligner.patientName}</td>
                          <td>{aligner.caseNumber}</td>
                          <td>第{aligner.stageNumber}阶段</td>
                          <td>{aligner.arrivedPairs}副</td>
                          <td>
                            <span className="location-text">
                              {aligner.cabinetNumber}柜-{aligner.layerNumber}层-{aligner.cellNumber}格
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="pairs-input"
                              value={selection.pairsTaken}
                              min="1"
                              max={aligner.arrivedPairs}
                              onChange={e => handleUpdatePairsTaken(aligner.id, parseInt(e.target.value) || 0)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleBatchSubmit}>
                <div className="form-group">
                  <label>领取人 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={batchForm.receiver}
                    onChange={e => setBatchForm(prev => ({ ...prev, receiver: e.target.value }))}
                    placeholder="请输入领取人姓名"
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>身份</label>
                    <select
                      value={batchForm.receiverRole}
                      onChange={e => setBatchForm(prev => ({ ...prev, receiverRole: e.target.value }))}
                    >
                      {roleOptions.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>用途 <span className="required">*</span></label>
                    <select
                      value={batchForm.purpose}
                      onChange={e => setBatchForm(prev => ({ ...prev, purpose: e.target.value as HandoverPurpose }))}
                    >
                      {purposeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>操作员</label>
                  <input
                    type="text"
                    value={batchForm.operator}
                    onChange={e => setBatchForm(prev => ({ ...prev, operator: e.target.value }))}
                    placeholder="默认为管理员"
                  />
                </div>

                <div className="form-group">
                  <label>备注</label>
                  <textarea
                    value={batchForm.remark}
                    onChange={e => setBatchForm(prev => ({ ...prev, remark: e.target.value }))}
                    placeholder="特殊情况说明"
                    rows={2}
                  />
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowBatchModal(false)}
                  >
                    取消
                  </button>
                  <button type="submit" className="btn btn-primary">
                    确认批量交接
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showRevokeModal && revokingRecord && (
        <div className="modal-overlay" onClick={() => setShowRevokeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认撤销交接记录</h3>
              <button className="close-btn" onClick={() => setShowRevokeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="revoke-warning">
                <div className="revoke-warning-icon">⚠️</div>
                <div className="revoke-warning-text">
                  <strong>警告：</strong>撤销后将恢复库存数量和柜位占用
                </div>
              </div>

              <div className="revoke-info-summary">
                <div className="revoke-info-row">
                  <span className="revoke-info-label">领取人：</span>
                  <span className="revoke-info-value">{revokingRecord.receiver}（{revokingRecord.receiverRole}）</span>
                </div>
                <div className="revoke-info-row">
                  <span className="revoke-info-label">副数：</span>
                  <span className="revoke-info-value">{revokingRecord.pairsTaken}副</span>
                </div>
                <div className="revoke-info-row">
                  <span className="revoke-info-label">用途：</span>
                  <span className="revoke-info-value">{getPurposeLabel(revokingRecord.purpose)}</span>
                </div>
                <div className="revoke-info-row">
                  <span className="revoke-info-label">日期：</span>
                  <span className="revoke-info-value">
                    {new Date(revokingRecord.handoverDate).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>

              <form onSubmit={handleRevokeSubmit}>
                <div className="form-group">
                  <label>撤销原因 <span className="required">*</span></label>
                  <textarea
                    value={revokeForm.reason}
                    onChange={e => setRevokeForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="请输入撤销原因（至少5个字）"
                    rows={3}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>撤销人</label>
                  <input
                    type="text"
                    value={revokeForm.operator}
                    onChange={e => setRevokeForm(prev => ({ ...prev, operator: e.target.value }))}
                    placeholder="默认为管理员"
                  />
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRevokeModal(false)}
                  >
                    取消
                  </button>
                  <button type="submit" className="btn btn-danger">
                    确认撤销
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mode-toggle-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
          gap: 12px;
        }

        .mode-buttons {
          display: flex;
          gap: 4px;
          background: #f8f9fa;
          padding: 4px;
          border-radius: 8px;
        }

        .mode-btn {
          padding: 8px 20px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-secondary);
          font-family: inherit;
        }

        .mode-btn:hover {
          color: var(--primary-color);
        }

        .mode-btn.active {
          background: var(--primary-color);
          color: white;
          font-weight: 500;
        }

        .batch-actions-bar {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .selection-count {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .selection-count strong {
          color: var(--primary-color);
          font-size: 16px;
        }

        .batch-handover-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .patient-group {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          overflow: hidden;
          transition: all 0.2s;
        }

        .patient-group:hover {
          border-color: var(--primary-color);
        }

        .patient-group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid var(--border-color);
        }

        .patient-group-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .group-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .patient-group-title {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .patient-group-title .case-number {
          font-size: 12px;
          font-weight: normal;
        }

        .stage-count {
          font-size: 12px;
          color: var(--primary-color);
          background: var(--primary-light);
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: normal;
        }

        .collapse-icon {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: normal;
          margin-left: 8px;
        }

        .patient-group-content {
          padding: 12px 16px;
        }

        .handover-item.selected {
          background: var(--primary-light);
          border-color: var(--primary-color);
        }

        .handover-checkbox {
          flex-shrink: 0;
          margin-right: 12px;
        }

        .handover-checkbox input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .batch-summary-bar {
          display: flex;
          gap: 24px;
          padding: 12px 16px;
          background: var(--primary-light);
          border-radius: var(--radius-sm);
          margin-bottom: 20px;
        }

        .batch-summary-item {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .batch-summary-item strong {
          color: var(--text-primary);
          font-size: 18px;
        }

        .batch-summary-item strong.highlight {
          color: var(--primary-color);
        }

        .batch-items-list {
          margin-bottom: 20px;
        }

        .batch-items-list h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-primary);
        }

        .batch-items-table {
          width: 100%;
          border-collapse: collapse;
        }

        .batch-items-table th {
          padding: 10px 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          background: #f8f9fa;
          border-bottom: 2px solid var(--border-color);
        }

        .batch-items-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-color);
          font-size: 13px;
        }

        .batch-items-table tbody tr:hover {
          background: #f8f9fa;
        }

        .location-text {
          color: var(--primary-color);
          font-weight: 500;
        }

        .pairs-input {
          width: 80px;
          padding: 6px 10px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 13px;
          font-family: inherit;
        }

        .pairs-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(26, 95, 180, 0.1);
        }

        .other-stages-section {
          margin-bottom: 20px;
          padding: 12px;
          background: #fff8e1;
          border-radius: var(--radius-sm);
          border-left: 3px solid var(--warning-color);
        }

        .other-stages-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .other-stages-title {
          font-size: 13px;
          font-weight: 600;
          color: #f57f17;
        }

        .other-stages-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .stage-tag {
          background: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          color: var(--text-secondary);
          border: 1px solid #ffe082;
        }

        .batch-tag {
          display: inline-block;
          background: var(--primary-light);
          color: var(--primary-color);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .single-tag {
          display: inline-block;
          background: #e9ecef;
          color: var(--text-secondary);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .batch-sub-tag {
          color: var(--text-muted);
          font-size: 14px;
          margin-left: 10px;
        }

        .record-group-header {
          background: #f8f9fa;
          cursor: pointer;
        }

        .record-group-header:hover {
          background: #e9ecef !important;
        }

        .record-group-item {
          background: #fafafa;
        }

        .record-group-item td:first-child {
          padding-left: 20px;
        }

        .revoked-row {
          color: #999 !important;
          text-decoration: line-through;
        }

        .revoked-tag {
          display: inline-block;
          background: #fde8e8;
          color: #dc3545;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          margin-left: 6px;
        }

        .partial-revoked-tag {
          display: inline-block;
          background: #fff3cd;
          color: #856404;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          margin-left: 6px;
        }

        .revoke-info {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #ddd;
          font-size: 12px;
          color: #dc3545;
          text-decoration: none;
          line-height: 1.6;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
          font-family: inherit;
        }

        .btn-danger:hover {
          background: #c82333;
        }

        .btn-danger:disabled {
          background: #e57373;
          cursor: not-allowed;
        }

        .btn-danger.btn-sm {
          padding: 4px 12px;
          font-size: 12px;
        }

        .revoke-warning {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #fff3cd;
          border: 1px solid #ffe082;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .revoke-warning-icon {
          font-size: 24px;
        }

        .revoke-warning-text {
          font-size: 14px;
          color: #856404;
        }

        .revoke-warning-text strong {
          color: #dc3545;
        }

        .revoke-info-summary {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .revoke-info-row {
          display: flex;
          padding: 6px 0;
          font-size: 14px;
        }

        .revoke-info-label {
          color: var(--text-secondary);
          width: 80px;
          flex-shrink: 0;
        }

        .revoke-info-value {
          color: var(--text-primary);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

export default HandoverPage;
