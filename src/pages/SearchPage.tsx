import { useState } from 'react';
import { alignerStore, handoverStore, patientStore, operationStore } from '../store';
import type { OperationLog, Aligner, HandoverRecord, Patient, OperationType } from '../types';
import LabelPrintModal from '../components/LabelPrintModal';

const OPERATION_CONFIG: Record<OperationType, { icon: string; color: string; label: string }> = {
  'stock-in': { icon: '📥', color: '#1a5fb4', label: '入库登记' },
  'shelf-on': { icon: '🗄️', color: '#28a745', label: '上架' },
  'shelf-off': { icon: '📦', color: '#fd7e14', label: '下架/移出柜位' },
  'handover': { icon: '📋', color: '#6f42c1', label: '交接领取' },
  'handover-revoke': { icon: '↩️', color: '#dc3545', label: '交接撤销' },
  'doctor-update': { icon: '👨‍⚕️', color: '#17a2b8', label: '补录/修改医生' },
  'inventory': { icon: '🔍', color: '#ffc107', label: '盘点' },
};

function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Aligner[]>([]);
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [handoverResults, setHandoverResults] = useState<HandoverRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedAligner, setSelectedAligner] = useState<Aligner | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedAlignerRecords, setSelectedAlignerRecords] = useState<HandoverRecord[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleSearch = () => {
    if (!keyword.trim()) {
      setSearchResults([]);
      setPatientResults([]);
      setHandoverResults([]);
      setHasSearched(false);
      return;
    }

    const aligners = alignerStore.search(keyword.trim());
    const patients = patientStore.getAll().filter(p =>
      p.name.includes(keyword.trim()) ||
      p.caseNumber.includes(keyword.trim())
    );
    const handovers = handoverStore.search(keyword.trim());

    setSearchResults(aligners);
    setPatientResults(patients);
    setHandoverResults(handovers);
    setHasSearched(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleViewDetail = (aligner: Aligner) => {
    setSelectedAligner(aligner);
    const records = handoverStore.getByAlignerId(aligner.id);
    setSelectedAlignerRecords(records);
    setShowDetailModal(true);
  };

  const handlePrintLabel = (aligner: Aligner) => {
    setSelectedAligner(aligner);
    setShowLabelModal(true);
  };

  const getStatusLabel = (status: Aligner['status']) => {
    const labels: Record<Aligner['status'], string> = {
      pending: '待上架',
      stored: '已上架',
      handed_over: '已领取',
      returned: '已退回',
      damaged: '已损坏',
    };
    return labels[status];
  };

  const getStatusClass = (status: Aligner['status']) => {
    const classes: Record<Aligner['status'], string> = {
      pending: 'status-pending',
      stored: 'status-stored',
      handed_over: 'status-handed',
      returned: 'status-returned',
      damaged: 'status-damaged',
    };
    return classes[status];
  };

  const getPurposeLabel = (purpose: HandoverRecord['purpose']) => {
    const labels: Record<HandoverRecord['purpose'], string> = {
      clinic_delivery: '当场发放',
      chairside_check: '诊室检查',
      return: '退回',
      reissue: '补发',
      damage: '包装损坏',
    };
    return labels[purpose];
  };

  const getPatientDoctor = (patientId: string): string | undefined => {
    return patientStore.getById(patientId)?.doctor;
  };

  const isHandoverRevoked = (log: OperationLog): boolean => {
    if (log.details?.isRevoked !== undefined) {
      return log.details.isRevoked;
    }
    const handoverId = log.details?.handoverId;
    if (handoverId) {
      const record = handoverStore.getAll().find(h => h.id === handoverId);
      if (record) {
        return !!record.isRevoked;
      }
    }
    return false;
  };

  const renderTimelineContent = (log: OperationLog) => {
    const details = log.details || {};

    switch (log.type) {
      case 'stock-in':
        return (
          <>
            <p><strong>入库日期：</strong>{new Date(log.date).toLocaleString('zh-CN')}</p>
            <p><strong>副数：</strong>{details.pairs || details.arrivedPairs || '-'}副</p>
            <p><strong>厂家：</strong>{details.manufacturer || '-'}</p>
            <p><strong>操作员：</strong>{log.operator}</p>
          </>
        );
      case 'shelf-on':
        return (
          <>
            <p><strong>上架位置：</strong>{details.cabinetNumber}柜-{details.layerNumber}层-{details.cellNumber}格</p>
            <p><strong>操作员：</strong>{log.operator}</p>
          </>
        );
      case 'shelf-off':
        return (
          <>
            <p><strong>原位置：</strong>{details.cabinetNumber}柜-{details.layerNumber}层-{details.cellNumber}格</p>
            <p><strong>下架原因：</strong>{details.reason || '-'}</p>
            <p><strong>操作员：</strong>{log.operator}</p>
          </>
        );
      case 'handover': {
        const isRevoked = isHandoverRevoked(log);
        return (
          <>
            <p><strong>领取人：</strong>{details.receiver || '-'} ({details.receiverRole || '-'})</p>
            <p><strong>领取副数：</strong>{details.pairs || details.pairsTaken || '-'}副</p>
            <p><strong>用途：</strong>{details.purpose ? getPurposeLabel(details.purpose) : '-'}</p>
            <p><strong>操作员：</strong>{log.operator}</p>
            {details.remark && <p><strong>备注：</strong>{details.remark}</p>}
            <p className="timeline-handover-id">交接记录ID: {details.handoverId || log.id}</p>
            {isRevoked && <span className="revoked-badge">已撤销</span>}
          </>
        );
      }
      case 'handover-revoke':
        return (
          <>
            <p><strong>撤销原因：</strong>{details.reason || details.revokeReason || '-'}</p>
            <p><strong>撤销人：</strong>{details.revokedBy || log.operator}</p>
            <p><strong>撤销时间：</strong>{new Date(log.date).toLocaleString('zh-CN')}</p>
            {details.originalHandoverId && <p><strong>原交接记录：</strong>{details.originalHandoverId}</p>}
          </>
        );
      case 'doctor-update':
        return (
          <>
            <p><strong>新医生姓名：</strong>{details.doctor || '-'}</p>
            <p><strong>操作人：</strong>{log.operator}</p>
          </>
        );
      case 'inventory':
        return (
          <>
            <p><strong>盘点柜位：</strong>{details.location || (details.cabinetNumber ? `${details.cabinetNumber}柜-${details.layerNumber}层-${details.cellNumber}格` : '-')}</p>
            <p><strong>盘点结果：</strong>{details.status || '-'}</p>
            <p><strong>盘点人：</strong>{details.inventoryBy || log.operator}</p>
          </>
        );
      default:
        return <p>{log.description}</p>;
    }
  };

  const stats = {
    total: searchResults.length,
    pending: searchResults.filter(a => a.status === 'pending').length,
    stored: searchResults.filter(a => a.status === 'stored').length,
    handedOver: searchResults.filter(a => a.status === 'handed_over').length,
  };

  const selectedPatient = selectedAligner ? patientStore.getById(selectedAligner.patientId) : undefined;
  const operationLogs = selectedAligner
    ? operationStore.getByAlignerId(selectedAligner.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const timelineStyles = `
    .operation-timeline {
      position: relative;
      padding-left: 32px;
      margin-top: 16px;
    }
    .operation-timeline::before {
      content: '';
      position: absolute;
      left: 11px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e0e0e0;
    }
    .operation-timeline-item {
      position: relative;
      margin-bottom: 24px;
    }
    .operation-timeline-item:last-child {
      margin-bottom: 0;
    }
    .timeline-dot {
      position: absolute;
      left: -32px;
      top: 2px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: white;
      z-index: 1;
      box-shadow: 0 0 0 3px white;
    }
    .timeline-content {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .timeline-content.revoked {
      opacity: 0.6;
    }
    .timeline-content.revoked p {
      text-decoration: line-through;
      color: #999;
    }
    .timeline-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .timeline-title-text {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .timeline-date {
      font-size: 12px;
      color: #888;
      font-weight: normal;
    }
    .timeline-body p {
      margin: 4px 0;
      font-size: 13px;
      color: #555;
    }
    .timeline-body strong {
      color: #333;
    }
    .timeline-handover-id {
      font-size: 11px;
      color: #999;
      margin-top: 8px !important;
    }
    .revoked-badge {
      display: inline-block;
      background: #dc3545;
      color: white;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 6px;
    }
    .doctor-warning {
      display: inline-block;
      background: #dc3545;
      color: white;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-left: 6px;
    }
    .doctor-pending-small {
      color: #dc3545;
      font-size: 12px;
      font-weight: bold;
    }
  `;

  return (
    <div className="search-page">
      <style>{timelineStyles}</style>

      <div className="search-header">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input-large"
            placeholder="搜索患者姓名、病例号、阶段编号..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button className="btn btn-primary btn-search" onClick={handleSearch}>
            🔍 搜索
          </button>
        </div>
        <p className="search-hint">输入患者姓名、病例号或阶段编号进行搜索，按回车快速搜索</p>
      </div>

      {hasSearched && (
        <>
          {searchResults.length === 0 && patientResults.length === 0 && handoverResults.length === 0 ? (
            <div className="empty-state large">
              <div className="empty-icon">🔍</div>
              <p>未找到与 "{keyword}" 相关的记录</p>
              <p className="empty-hint">请尝试其他关键词</p>
            </div>
          ) : (
            <>
              {searchResults.length > 0 && (
                <div className="section-card">
                  <div className="section-title">
                    <span className="title-icon">🦷</span>
                    <h3>牙套记录</h3>
                    <span className="badge">{searchResults.length} 条</span>
                  </div>

                  <div className="search-stats">
                    <span className="stat">总计：{stats.total}</span>
                    <span className="stat pending">待上架：{stats.pending}</span>
                    <span className="stat stored">已上架：{stats.stored}</span>
                    <span className="stat handed">已领取：{stats.handedOver}</span>
                  </div>

                  <div className="aligner-grid">
                    {searchResults.map((aligner) => {
                      const doctor = getPatientDoctor(aligner.patientId);
                      return (
                        <div key={aligner.id} className="aligner-card">
                          <div className="card-header">
                            <span className="patient-name">{aligner.patientName}</span>
                            <span className={`status-badge ${getStatusClass(aligner.status)}`}>
                              {getStatusLabel(aligner.status)}
                            </span>
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
                              <span className="info-label">医生</span>
                              {doctor ? (
                                <span className="info-value">{doctor}</span>
                              ) : (
                                <span className="doctor-pending-small">待补</span>
                              )}
                            </div>
                            {aligner.status === 'stored' && (
                              <div className="info-row location-highlight">
                                <span className="info-label">📍 位置</span>
                                <span className="info-value location">
                                  {aligner.cabinetNumber}柜-{aligner.layerNumber}层-{aligner.cellNumber}格
                                </span>
                              </div>
                            )}
                            {aligner.status !== 'stored' && aligner.status !== 'pending' && (
                              <div className="info-row">
                                <span className="info-label">库存</span>
                                <span className="info-value">{aligner.arrivedPairs}副</span>
                              </div>
                            )}
                            <div className="info-row">
                              <span className="info-label">厂家</span>
                              <span className="info-value">{aligner.manufacturer}</span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">到货日期</span>
                              <span className="info-value">
                                {new Date(aligner.arrivedDate).toLocaleDateString('zh-CN')}
                              </span>
                            </div>
                          </div>
                          <div className="card-footer">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleViewDetail(aligner)}
                            >
                              详细记录
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handlePrintLabel(aligner)}
                            >
                              打印标签
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {patientResults.length > 0 && (
                <div className="section-card">
                  <div className="section-title">
                    <span className="title-icon">👤</span>
                    <h3>患者信息</h3>
                    <span className="badge">{patientResults.length} 位</span>
                  </div>
                  <div className="patient-list">
                    {patientResults.map((patient) => (
                      <div key={patient.id} className="patient-item">
                        <div className="patient-avatar">
                          {patient.name.charAt(0)}
                        </div>
                        <div className="patient-details">
                          <div className="patient-name">{patient.name}</div>
                          <div className="patient-meta">
                            <span>病例号：{patient.caseNumber}</span>
                            {patient.doctor ? (
                              <span>主治医生：{patient.doctor}</span>
                            ) : (
                              <span className="doctor-warning">待补医生信息</span>
                            )}
                            {patient.phone && <span>电话：{patient.phone}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {handoverResults.length > 0 && (
                <div className="section-card">
                  <div className="section-title">
                    <span className="title-icon">📋</span>
                    <h3>交接记录</h3>
                    <span className="badge">{handoverResults.length} 条</span>
                  </div>
                  <div className="records-table-wrapper">
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>患者</th>
                          <th>领取人</th>
                          <th>副数</th>
                          <th>用途</th>
                          <th>操作员</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {handoverResults.slice(0, 20).map((record) => (
                          <tr
                            key={record.id}
                            style={record.isRevoked ? { opacity: 0.6, textDecoration: 'line-through', color: '#999' } : {}}
                          >
                            <td>
                              {new Date(record.handoverDate).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {record.isRevoked && <span className="revoked-badge">已撤销</span>}
                            </td>
                            <td className="patient-cell">{record.patientName}</td>
                            <td>{record.receiver}</td>
                            <td>{record.pairsTaken}副</td>
                            <td>{getPurposeLabel(record.purpose)}</td>
                            <td>{record.operator}</td>
                            <td className="remark-cell">{record.remark || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {handoverResults.length > 20 && (
                      <p className="more-hint">还有 {handoverResults.length - 20} 条记录，请缩小搜索范围查看</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!hasSearched && (
        <div className="search-tips">
          <div className="tips-card">
            <h3>🔍 搜索提示</h3>
            <ul>
              <li>输入<strong>患者姓名</strong>查找所有相关牙套记录</li>
              <li>输入<strong>病例号</strong>精确查找特定患者</li>
              <li>输入<strong>阶段编号</strong>查找特定阶段的牙套</li>
              <li>搜索结果包含牙套位置、状态和交接历史</li>
            </ul>
          </div>
          <div className="tips-card">
            <h3>📋 常用操作</h3>
            <ul>
              <li>前台查询患者牙套位置 → 搜索患者姓名</li>
              <li>查看牙套交接历史 → 点击"详细记录"</li>
              <li>补打标签 → 点击"打印标签"</li>
            </ul>
          </div>
        </div>
      )}

      {showDetailModal && selectedAligner && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>牙套详细信息</h3>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>基本信息</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">患者姓名</span>
                    <span className="detail-value">{selectedAligner.patientName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">病例号</span>
                    <span className="detail-value">{selectedAligner.caseNumber}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">阶段</span>
                    <span className="detail-value">第{selectedAligner.stageNumber}阶段</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">厂家</span>
                    <span className="detail-value">{selectedAligner.manufacturer}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">主治医生</span>
                    {selectedPatient?.doctor ? (
                      <span className="detail-value">{selectedPatient.doctor}</span>
                    ) : selectedAligner.needDoctorInfo ? (
                      <span className="doctor-warning">待补医生信息</span>
                    ) : (
                      <span className="detail-value">-</span>
                    )}
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">当前状态</span>
                    <span className={`status-badge ${getStatusClass(selectedAligner.status)}`}>
                      {getStatusLabel(selectedAligner.status)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">当前库存</span>
                    <span className="detail-value">{selectedAligner.arrivedPairs}副</span>
                  </div>
                  {selectedAligner.status === 'stored' && (
                    <div className="detail-item full-width">
                      <span className="detail-label">存放位置</span>
                      <span className="detail-value location">
                        📍 {selectedAligner.cabinetNumber}柜-{selectedAligner.layerNumber}层-{selectedAligner.cellNumber}格
                      </span>
                    </div>
                  )}
                  <div className="detail-item full-width">
                    <span className="detail-label">备注</span>
                    <span className="detail-value">{selectedAligner.remark || '无'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>完整流转时间线 ({operationLogs.length})</h4>
                {operationLogs.length === 0 ? (
                  <p className="no-records">暂无操作记录</p>
                ) : (
                  <div className="operation-timeline">
                    {operationLogs.map((log) => {
                      const config = OPERATION_CONFIG[log.type];
                      const isRevoked = log.type === 'handover' && isHandoverRevoked(log);
                      return (
                        <div key={log.id} className="operation-timeline-item">
                          <div
                            className="timeline-dot"
                            style={{ backgroundColor: config.color }}
                          >
                            {config.icon}
                          </div>
                          <div className={`timeline-content${isRevoked ? ' revoked' : ''}`}>
                            <div className="timeline-title">
                              <span className="timeline-title-text" style={{ color: config.color }}>
                                {config.label}
                                {isRevoked && <span className="revoked-badge">已撤销</span>}
                              </span>
                              <span className="timeline-date">
                                {new Date(log.date).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <div className="timeline-body">
                              {renderTimelineContent(log)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h4>交接记录 ({selectedAlignerRecords.length})</h4>
                {selectedAlignerRecords.length === 0 ? (
                  <p className="no-records">暂无交接记录</p>
                ) : (
                  <div className="records-table-wrapper">
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>领取人</th>
                          <th>身份</th>
                          <th>副数</th>
                          <th>用途</th>
                          <th>操作员</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAlignerRecords.map((record) => (
                          <tr
                            key={record.id}
                            style={record.isRevoked ? { opacity: 0.6, textDecoration: 'line-through', color: '#999' } : {}}
                          >
                            <td>
                              {new Date(record.handoverDate).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {record.isRevoked && <span className="revoked-badge">已撤销</span>}
                            </td>
                            <td>{record.receiver}</td>
                            <td>{record.receiverRole}</td>
                            <td>{record.pairsTaken}副</td>
                            <td>{getPurposeLabel(record.purpose)}</td>
                            <td>{record.operator}</td>
                            <td className="remark-cell">{record.remark || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {selectedAlignerRecords.some((r) => r.isRevoked) && (
                      <div style={{ marginTop: 12, padding: 10, background: '#fff5f5', borderRadius: 6, fontSize: 13 }}>
                        <strong style={{ color: '#dc3545' }}>撤销信息：</strong>
                        {selectedAlignerRecords.filter((r) => r.isRevoked).map((record) => (
                          <div key={record.id} style={{ marginTop: 6, color: '#666' }}>
                            - 交接记录 {record.id}：撤销人 {record.revokedBy || '-'}，原因：{record.revokeReason || '-'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => handlePrintLabel(selectedAligner)}
              >
                打印标签
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowDetailModal(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showLabelModal && selectedAligner && (
        <LabelPrintModal
          aligner={selectedAligner}
          onClose={() => {
            setShowLabelModal(false);
            setSelectedAligner(null);
          }}
        />
      )}
    </div>
  );
}

export default SearchPage;
