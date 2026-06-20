import { useState, useEffect } from 'react';
import { calculateMonthlyStats, exportRecords, downloadCSV } from '../store';
import { alignerStore, shelfHistoryStore, handoverStore, inventoryStore, patientStore } from '../store';
import type { MonthlyStats } from '../types';

function MonthlyReportPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [detailType, setDetailType] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, [selectedYear, selectedMonth]);

  const loadStats = () => {
    const result = calculateMonthlyStats(selectedYear, selectedMonth);
    setStats(result);
    setDetailType(null);
    setDetailData([]);
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const getMonthRange = () => {
    const start = new Date(selectedYear, selectedMonth - 1, 1);
    const end = new Date(selectedYear, selectedMonth, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const handleViewDetail = (type: string) => {
    const { start, end } = getMonthRange();
    const startTime = new Date(start).getTime();
    const endTime = new Date(end + 'T23:59:59').getTime();
    let data: any[] = [];

    switch (type) {
      case 'stock-in': {
        const aligners = alignerStore.getAll().filter(a => {
          const t = new Date(a.arrivedDate).getTime();
          return t >= startTime && t <= endTime;
        });
        data = aligners.map(a => ({
          date: new Date(a.arrivedDate).toLocaleDateString('zh-CN'),
          patientName: a.patientName,
          caseNumber: a.caseNumber,
          stage: `第${a.stageNumber}阶段`,
          pairs: a.originalArrivedPairs || a.arrivedPairs,
          manufacturer: a.manufacturer,
          doctor: patientStore.getById(a.patientId)?.doctor || (a.hasDoctorInfo ? '已录' : '待补'),
          status: a.status === 'pending' ? '待上架' :
                  a.status === 'stored' ? '在库' :
                  a.status === 'handed_over' ? '已领取' :
                  a.status === 'returned' ? '已退回' : '已损坏',
        }));
        break;
      }
      case 'shelf': {
        const records = shelfHistoryStore.getByDateRange(start, end);
        data = records.map(r => ({
          storedDate: new Date(r.storedDate).toLocaleDateString('zh-CN'),
          removedDate: r.removedDate ? new Date(r.removedDate).toLocaleDateString('zh-CN') : '-',
          patientName: r.patientName,
          caseNumber: r.caseNumber,
          stage: `第${r.stageNumber}阶段`,
          location: `${r.cabinetNumber}柜-${r.layerNumber}层-${r.cellNumber}格`,
          removedReason: r.removedReason || '-',
        }));
        break;
      }
      case 'handover': {
        const records = handoverStore.getAll().filter(h => {
          const t = new Date(h.handoverDate).getTime();
          return t >= startTime && t <= endTime && !h.isRevoked;
        });
        data = records.map(r => ({
          date: new Date(r.handoverDate).toLocaleString('zh-CN'),
          patientName: r.patientName,
          caseNumber: r.caseNumber,
          receiver: `${r.receiver}(${r.receiverRole})`,
          pairs: r.pairsTaken,
          purpose: r.purpose === 'clinic_delivery' ? '当场发放' :
                   r.purpose === 'chairside_check' ? '诊室检查' :
                   r.purpose === 'return' ? '退回' :
                   r.purpose === 'reissue' ? '补发' : '包装损坏',
          operator: r.operator,
          remark: r.remark || '-',
        }));
        break;
      }
      case 'in-stock': {
        const aligners = alignerStore.getStoredList();
        data = aligners.map(a => ({
          patientName: a.patientName,
          caseNumber: a.caseNumber,
          stage: `第${a.stageNumber}阶段`,
          pairs: a.arrivedPairs,
          location: `${a.cabinetNumber}柜-${a.layerNumber}层-${a.cellNumber}格`,
          manufacturer: a.manufacturer,
          storedDate: a.storedDate ? new Date(a.storedDate).toLocaleDateString('zh-CN') : '-',
          doctor: patientStore.getById(a.patientId)?.doctor || (a.hasDoctorInfo ? '已录' : '待补'),
        }));
        break;
      }
      case 'abnormal': {
        const inventoryRecords = inventoryStore.getAllRecords().filter(r => {
          const t = new Date(r.inventoryDate).getTime();
          return t >= startTime && t <= endTime && (r.status === 'mismatch' || r.status === 'missing');
        });
        data = inventoryRecords.map(r => ({
          date: new Date(r.inventoryDate).toLocaleString('zh-CN'),
          location: `${r.cabinetNumber}柜-${r.layerNumber}层-${r.cellNumber}格`,
          expected: r.expectedPatientName ? `${r.expectedPatientName}(${r.expectedCaseNumber})` : '-',
          actual: r.actualPatientName ? `${r.actualPatientName}(${r.actualCaseNumber})` : '-',
          status: r.status === 'mismatch' ? '错放' : '缺失',
          inventoryBy: r.inventoryBy,
          remark: r.remark || '-',
        }));
        break;
      }
    }

    setDetailType(type);
    setDetailData(data);
  };

  const handleExportDetail = () => {
    if (!detailType || detailData.length === 0) return;

    const typeLabels: Record<string, string> = {
      'stock-in': '入库明细',
      'shelf': '上架明细',
      'handover': '交接明细',
      'in-stock': '在库明细',
      'abnormal': '异常盘点明细',
    };

    const headersMap: Record<string, string[]> = {
      'stock-in': ['入库日期', '患者姓名', '病例号', '阶段', '副数', '厂家', '主治医生', '当前状态'],
      'shelf': ['上架日期', '下架日期', '患者姓名', '病例号', '阶段', '柜位', '下架原因'],
      'handover': ['交接日期', '患者姓名', '病例号', '领取人', '副数', '用途', '操作员', '备注'],
      'in-stock': ['患者姓名', '病例号', '阶段', '副数', '存放位置', '厂家', '上架日期', '主治医生'],
      'abnormal': ['盘点日期', '柜位', '应有牙套', '实有牙套', '异常类型', '盘点人', '备注'],
    };

    const headers = headersMap[detailType] || [];
    const csvContent = [
      headers.join(','),
      ...detailData.map(row => 
        headers.map(h => {
          const key = Object.keys(row)[headers.indexOf(h)];
          return `"${row[key] || ''}"`;
        }).join(',')
      ),
    ].join('\n');

    const BOM = '\uFEFF';
    const { start, end } = getMonthRange();
    downloadCSV(BOM + csvContent, `${typeLabels[detailType]}_${selectedYear}年${selectedMonth}月_${start}_${end}.csv`);
  };

  const handleExportAll = () => {
    const { start, end } = getMonthRange();
    const types = ['stock-in', 'shelf', 'handover'] as const;
    types.forEach(type => {
      const content = exportRecords({ startDate: start, endDate: end, recordType: type });
      const typeLabels: Record<string, string> = {
        'stock-in': '入库记录',
        'shelf': '上架记录',
        'handover': '交接记录',
      };
      downloadCSV(content, `${typeLabels[type]}_${selectedYear}年${selectedMonth}月.csv`);
    });
  };

  const statCards = stats ? [
    { 
      key: 'stock-in', 
      label: '入库数量', 
      value: stats.stockInCount, 
      subValue: `${stats.stockInPairs}副`,
      icon: '📥', 
      color: '#1a5fb4',
      bgColor: '#e8f4fd'
    },
    { 
      key: 'shelf', 
      label: '上架数量', 
      value: stats.shelfOnCount, 
      subValue: `${stats.shelfOnPairs}副`,
      icon: '🗄️', 
      color: '#28a745',
      bgColor: '#e8f5e9'
    },
    { 
      key: 'handover', 
      label: '交接数量', 
      value: stats.handoverCount, 
      subValue: `${stats.handoverPairs}副`,
      icon: '📋', 
      color: '#6f42c1',
      bgColor: '#f3e5f5'
    },
    { 
      key: 'in-stock', 
      label: '当前在库', 
      value: stats.currentInStockCount, 
      subValue: `${stats.currentInStockPairs}副`,
      icon: '📦', 
      color: '#fd7e14',
      bgColor: '#fff3e0'
    },
    { 
      key: 'abnormal', 
      label: '异常盘点', 
      value: stats.abnormalInventoryCount, 
      subValue: '条',
      icon: '⚠️', 
      color: '#dc3545',
      bgColor: '#ffebee'
    },
  ] : [];

  const detailColumns: Record<string, string[]> = {
    'stock-in': ['入库日期', '患者姓名', '病例号', '阶段', '副数', '厂家', '主治医生', '当前状态'],
    'shelf': ['上架日期', '下架日期', '患者姓名', '病例号', '阶段', '柜位', '下架原因'],
    'handover': ['交接日期', '患者姓名', '病例号', '领取人', '副数', '用途', '操作员', '备注'],
    'in-stock': ['患者姓名', '病例号', '阶段', '副数', '存放位置', '厂家', '上架日期', '主治医生'],
    'abnormal': ['盘点日期', '柜位', '应有牙套', '实有牙套', '异常类型', '盘点人', '备注'],
  };

  return (
    <div className="monthly-report-page">
      <div className="section-card">
        <div className="section-title">
          <span className="title-icon">📊</span>
          <h3>月结看板</h3>
        </div>

        <div className="report-controls">
          <div className="control-group">
            <label>选择年份</label>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(parseInt(e.target.value))}
            >
              {years.map(y => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>选择月份</label>
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <button className="btn btn-primary" onClick={handleExportAll}>
              📥 导出全部月报
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          {statCards.map(card => (
            <div 
              key={card.key} 
              className="stat-card clickable"
              onClick={() => handleViewDetail(card.key)}
            >
              <div 
                className="stat-icon" 
                style={{ background: card.bgColor, color: card.color }}
              >
                {card.icon}
              </div>
              <div className="stat-info">
                <span className="stat-label">{card.label}</span>
                <span className="stat-value" style={{ color: card.color }}>
                  {card.value}
                </span>
                <span className="stat-sub">{card.subValue}</span>
              </div>
              <span className="stat-arrow">查看明细 →</span>
            </div>
          ))}
        </div>
      )}

      {detailType && (
        <div className="section-card">
          <div className="section-title">
            <span className="title-icon">📋</span>
            <h3>
              {detailType === 'stock-in' && '入库明细'}
              {detailType === 'shelf' && '上架明细'}
              {detailType === 'handover' && '交接明细'}
              {detailType === 'in-stock' && '当前在库明细'}
              {detailType === 'abnormal' && '异常盘点明细'}
            </h3>
            <span className="badge">共 {detailData.length} 条</span>
            <button 
              className="btn btn-secondary btn-sm" 
              style={{ marginLeft: 'auto' }}
              onClick={handleExportDetail}
              disabled={detailData.length === 0}
            >
              📥 导出明细
            </button>
            <button 
              className="btn-text"
              onClick={() => { setDetailType(null); setDetailData([]); }}
            >
              关闭
            </button>
          </div>

          {detailData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>暂无数据</p>
            </div>
          ) : (
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    {detailColumns[detailType]?.map((col, i) => (
                      <th key={i}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Object.values(row).map((cell, cellIndex) => (
                        <td key={cellIndex}>{String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        .report-controls {
          display: flex;
          align-items: flex-end;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .control-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .control-group label {
          font-size: 13px;
          color: var(--text-secondary);
          font-weight: 500;
        }
        
        .control-group select {
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-family: inherit;
          min-width: 120px;
        }
        
        .control-group select:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(26, 95, 180, 0.1);
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .stat-card.clickable {
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        
        .stat-card.clickable:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }
        
        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .stat-sub {
          font-size: 12px;
          color: var(--text-muted);
        }
        
        .stat-arrow {
          position: absolute;
          bottom: 16px;
          right: 20px;
          font-size: 12px;
          color: var(--text-muted);
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .stat-card.clickable:hover .stat-arrow {
          opacity: 1;
        }
        
        .preview-table-wrapper {
          overflow-x: auto;
          max-height: 500px;
          overflow-y: auto;
        }
        
        .preview-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .preview-table th {
          padding: 10px 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          background: #f8f9fa;
          border-bottom: 2px solid var(--border-color);
          position: sticky;
          top: 0;
          white-space: nowrap;
        }
        
        .preview-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-color);
          font-size: 13px;
          white-space: nowrap;
        }
        
        .preview-table tbody tr:hover {
          background: #f8f9fa;
        }
        
        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

export default MonthlyReportPage;
