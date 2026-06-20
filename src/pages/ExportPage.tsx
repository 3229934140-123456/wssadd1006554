import { useState } from 'react';
import { exportRecords, downloadCSV } from '../store';
import type { RecordType } from '../types';

function ExportPage() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    startDate: formatDate(firstDayOfMonth),
    endDate: formatDate(today),
    recordType: 'stock-in' as RecordType,
  });

  const [previewData, setPreviewData] = useState<any[][] | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[] | null>(null);

  const recordTypeOptions = [
    { value: 'stock-in', label: '入库记录', icon: '📥' },
    { value: 'shelf', label: '上架记录', icon: '🗄️' },
    { value: 'handover', label: '交接记录', icon: '📋' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as any }));
    setPreviewData(null);
    setPreviewHeaders(null);
  };

  const handlePreview = () => {
    if (!formData.startDate || !formData.endDate) {
      alert('请选择日期范围');
      return;
    }
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      alert('开始日期不能大于结束日期');
      return;
    }

    const csvContent = exportRecords({
      startDate: formData.startDate,
      endDate: formData.endDate,
      recordType: formData.recordType,
    });

    const lines = csvContent.replace(/^\uFEFF/, '').split('\n');
    if (lines.length > 0) {
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
      const data = lines.slice(1).filter(line => line.trim()).map(line => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current);
        return values;
      });

      setPreviewHeaders(headers);
      setPreviewData(data);
    }
  };

  const handleExport = () => {
    if (!formData.startDate || !formData.endDate) {
      alert('请选择日期范围');
      return;
    }
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      alert('开始日期不能大于结束日期');
      return;
    }

    const csvContent = exportRecords({
      startDate: formData.startDate,
      endDate: formData.endDate,
      recordType: formData.recordType,
    });

    const typeLabel = recordTypeOptions.find(o => o.value === formData.recordType)?.label;
    const filename = `${typeLabel}_${formData.startDate}_${formData.endDate}.csv`;
    
    downloadCSV(csvContent, filename);
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setFormData(prev => ({
      ...prev,
      startDate: formatDate(start),
      endDate: formatDate(end),
    }));
    setPreviewData(null);
    setPreviewHeaders(null);
  };

  return (
    <div className="export-page">
      <div className="section-card">
        <div className="section-title">
          <span className="title-icon">📊</span>
          <h3>数据导出</h3>
        </div>

        <div className="export-form">
          <div className="form-row">
            <div className="form-group">
              <label>记录类型</label>
              <div className="type-options">
                {recordTypeOptions.map(option => (
                  <label
                    key={option.value}
                    className={`type-option ${formData.recordType === option.value ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="recordType"
                      value={option.value}
                      checked={formData.recordType === option.value}
                      onChange={handleInputChange}
                    />
                    <span className="type-icon">{option.icon}</span>
                    <span className="type-text">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>开始日期</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>结束日期</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="quick-select">
            <span className="quick-label">快捷选择：</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickSelect(7)}>
              最近7天
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickSelect(30)}>
              最近30天
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickSelect(90)}>
              最近90天
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                setFormData(prev => ({
                  ...prev,
                  startDate: formatDate(firstDay),
                  endDate: formatDate(lastDay),
                }));
                setPreviewData(null);
                setPreviewHeaders(null);
              }}
            >
              本月
            </button>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handlePreview}
            >
              👁️ 预览数据
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleExport}
            >
              📥 导出 CSV
            </button>
          </div>
        </div>
      </div>

      {previewData !== null && previewHeaders !== null && (
        <div className="section-card">
          <div className="section-title">
            <span className="title-icon">📋</span>
            <h3>数据预览</h3>
            <span className="badge">共 {previewData.length} 条记录</span>
          </div>

          {previewData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>该日期范围内没有数据</p>
            </div>
          ) : (
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    {previewHeaders.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 50).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell: string, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 50 && (
                <p className="more-hint">仅显示前 50 条，共 {previewData.length} 条记录</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="section-card">
        <div className="section-title">
          <span className="title-icon">💡</span>
          <h3>导出说明</h3>
        </div>
        <div className="tips-content">
          <ul>
            <li><strong>入库记录</strong>：按到货日期筛选，包含所有已登记的牙套信息</li>
            <li><strong>上架记录</strong>：当前存放在柜中的牙套库存情况</li>
            <li><strong>交接记录</strong>：按交接日期筛选，包含所有领取、退回、补发等记录</li>
            <li>导出格式为 CSV，可用 Excel、WPS 等软件直接打开</li>
            <li>文件编码为 UTF-8 with BOM，确保中文显示正常</li>
            <li>建议月底对账时导出当月数据进行核对</li>
          </ul>
        </div>
      </div>

      <style>{`
        .type-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        
        .type-option {
          position: relative;
          padding: 16px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        
        .type-option:hover {
          border-color: var(--primary-color);
        }
        
        .type-option.selected {
          border-color: var(--primary-color);
          background: var(--primary-light);
        }
        
        .type-option input[type="radio"] {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }
        
        .type-icon {
          font-size: 28px;
          display: block;
          margin-bottom: 6px;
        }
        
        .type-text {
          font-size: 14px;
          font-weight: 500;
        }
        
        .type-option.selected .type-text {
          color: var(--primary-color);
        }
        
        .quick-select {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        
        .quick-label {
          font-size: 13px;
          color: var(--text-secondary);
          font-weight: 500;
        }
        
        .preview-table-wrapper {
          overflow-x: auto;
          max-height: 400px;
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
        }
        
        .preview-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-color);
          font-size: 13px;
        }
        
        .preview-table tbody tr:hover {
          background: #f8f9fa;
        }
        
        .tips-content ul {
          list-style: none;
        }
        
        .tips-content li {
          padding: 6px 0;
          font-size: 13px;
          color: var(--text-secondary);
          padding-left: 20px;
          position: relative;
        }
        
        .tips-content li::before {
          content: "•";
          position: absolute;
          left: 8px;
          color: var(--primary-color);
          font-weight: bold;
        }
        
        .tips-content strong {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}

export default ExportPage;
