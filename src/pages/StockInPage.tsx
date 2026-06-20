import { useState, useEffect, useMemo } from 'react';
import { patientStore, alignerStore, generateId, getExistingDoctorInfo } from '../store';
import type { Aligner, DuplicatePatientCheck, BatchStockInItem } from '../types';
import LabelPrintModal from '../components/LabelPrintModal';

interface StockInPageProps {
  onShelfChange?: () => void;
}

type TabType = 'single' | 'batch' | 'pending-doctor';

function StockInPage({ onShelfChange }: StockInPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('single');

  const [formData, setFormData] = useState({
    patientName: '',
    caseNumber: '',
    stageNumber: '',
    totalPairs: '',
    arrivedPairs: '',
    manufacturer: '',
    doctor: '',
    phone: '',
    remark: '',
  });

  const [pendingList, setPendingList] = useState<Aligner[]>([]);
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicatePatientCheck>({
    exists: false,
    patients: [],
  });
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedAligner, setSelectedAligner] = useState<Aligner | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [batchText, setBatchText] = useState('');
  const [batchItems, setBatchItems] = useState<BatchStockInItem[]>([]);
  const [showBatchExample, setShowBatchExample] = useState(false);

  const [pendingDoctorList, setPendingDoctorList] = useState<Aligner[]>([]);
  const [editingAligner, setEditingAligner] = useState<Aligner | null>(null);
  const [doctorInput, setDoctorInput] = useState('');
  const [showDoctorModal, setShowDoctorModal] = useState(false);

  useEffect(() => {
    loadPendingList();
    loadPendingDoctorList();
  }, []);

  useEffect(() => {
    if (activeTab === 'single') {
      loadPendingList();
    } else if (activeTab === 'pending-doctor') {
      loadPendingDoctorList();
    }
  }, [activeTab]);

  const loadPendingList = () => {
    const pending = alignerStore.getPendingList();
    setPendingList(pending.sort((a, b) =>
      new Date(b.arrivedDate).getTime() - new Date(a.arrivedDate).getTime()
    ));
  };

  const loadPendingDoctorList = () => {
    const allAligners = alignerStore.getAll();
    const pending = allAligners.filter(a => a.needDoctorInfo || !a.hasDoctorInfo);
    setPendingDoctorList(pending.sort((a, b) =>
      new Date(b.arrivedDate).getTime() - new Date(a.arrivedDate).getTime()
    ));
  };

  useEffect(() => {
    if (formData.patientName.trim().length >= 2) {
      const foundPatients = patientStore.findByName(formData.patientName.trim());
      if (foundPatients.length > 0) {
        setDuplicateCheck({ exists: true, patients: foundPatients });
        setShowDuplicateWarning(true);
      } else {
        setDuplicateCheck({ exists: false, patients: [] });
        setShowDuplicateWarning(false);
      }
    } else {
      setDuplicateCheck({ exists: false, patients: [] });
      setShowDuplicateWarning(false);
    }
  }, [formData.patientName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientName.trim() || !formData.caseNumber.trim() || !formData.stageNumber.trim()) {
      alert('请填写患者姓名、病例号和阶段编号');
      return;
    }

    const existingDoctor = getExistingDoctorInfo(formData.caseNumber.trim());
    const inputDoctor = formData.doctor.trim();
    const finalDoctor = inputDoctor || existingDoctor || '';
    const hasDoctor = !!finalDoctor;

    let patientId = '';
    const existingPatient = patientStore.findByCaseNumber(formData.caseNumber.trim());

    if (existingPatient) {
      patientId = existingPatient.id;
      if (finalDoctor && !existingPatient.doctor) {
        patientStore.update(existingPatient.id, { doctor: finalDoctor });
      }
    } else {
      const newPatient = patientStore.create({
        name: formData.patientName.trim(),
        caseNumber: formData.caseNumber.trim(),
        doctor: finalDoctor || undefined,
        phone: formData.phone.trim() || undefined,
      });
      patientId = newPatient.id;
    }

    const arrivedPairs = parseInt(formData.arrivedPairs) || 0;
    const totalPairs = parseInt(formData.totalPairs) || arrivedPairs;

    const newAligner = alignerStore.create({
      patientId,
      patientName: formData.patientName.trim(),
      caseNumber: formData.caseNumber.trim(),
      stageNumber: formData.stageNumber.trim(),
      totalPairs,
      arrivedPairs,
      status: 'pending',
      manufacturer: formData.manufacturer.trim() || '未知厂家',
      arrivedDate: new Date().toISOString(),
      remark: formData.remark.trim() || undefined,
      hasDoctorInfo: hasDoctor,
      needDoctorInfo: !hasDoctor,
      originalArrivedPairs: arrivedPairs,
    });

    setFormData({
      patientName: '',
      caseNumber: '',
      stageNumber: '',
      totalPairs: '',
      arrivedPairs: '',
      manufacturer: '',
      doctor: '',
      phone: '',
      remark: '',
    });

    const doctorSource = existingDoctor && !inputDoctor ? `（沿用已有医生：${existingDoctor}）` : '';
    setSuccessMessage(`已登记：${newAligner.patientName} - 第${newAligner.stageNumber}阶段${!hasDoctor ? '（待补医生）' : doctorSource}`);
    setTimeout(() => setSuccessMessage(''), 3000);

    loadPendingList();
    onShelfChange?.();
  };

  const handlePrintLabel = (aligner: Aligner) => {
    setSelectedAligner(aligner);
    setShowLabelModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条入库记录吗？')) {
      alignerStore.delete(id);
      loadPendingList();
      loadPendingDoctorList();
      onShelfChange?.();
    }
  };

  const handleScanInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value;
      if (value.includes('-')) {
        const parts = value.split('-');
        if (parts.length >= 3) {
          setFormData(prev => ({
            ...prev,
            caseNumber: parts[0] || '',
            patientName: parts[1] || '',
            stageNumber: parts[2] || '',
          }));
        }
      }
    }
  };

  const parseBatchText = () => {
    if (!batchText.trim()) {
      alert('请输入要解析的内容');
      return;
    }

    const lines = batchText.trim().split('\n').filter(line => line.trim());
    const items: BatchStockInItem[] = [];
    const seenCaseNumbers = new Set<string>();
    const seenNames = new Set<string>();
    const duplicateNames: string[] = [];
    const duplicateCases: string[] = [];

    lines.forEach((line, index) => {
      const rowNumber = index + 1;
      let parts: string[] = [];

      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes(',')) {
        parts = line.split(',');
      } else if (line.includes('-')) {
        const barcodeParts = line.split('-');
        parts = [
          barcodeParts[1] || '',
          barcodeParts[0] || '',
          barcodeParts[2] || '',
          '',
          '',
          '',
          '',
          '',
          '',
        ];
      } else {
        parts = [line];
      }

      parts = parts.map(p => p.trim());

      const item: BatchStockInItem = {
        id: generateId(),
        patientName: parts[0] || '',
        caseNumber: parts[1] || '',
        stageNumber: parts[2] || '',
        arrivedPairs: parts[3] || '',
        totalPairs: parts[4] || '',
        manufacturer: parts[5] || '',
        doctor: parts[6] || '',
        phone: parts[7] || '',
        remark: parts[8] || '',
        rowNumber,
        errors: [],
        warnings: [],
        isDuplicateName: false,
        isDuplicateCase: false,
        hasDoctor: !!parts[6]?.trim(),
        confirmed: false,
      };

      if (!item.patientName) item.errors.push('缺少患者姓名');
      if (!item.caseNumber) item.errors.push('缺少病例号');
      if (!item.stageNumber) item.errors.push('缺少阶段编号');

      if (seenCaseNumbers.has(item.caseNumber) && item.caseNumber) {
        item.isDuplicateCase = true;
        item.errors.push('病例号重复');
        if (!duplicateCases.includes(item.caseNumber)) {
          duplicateCases.push(item.caseNumber);
        }
      }
      seenCaseNumbers.add(item.caseNumber);

      if (seenNames.has(item.patientName) && item.patientName) {
        item.isDuplicateName = true;
        item.warnings.push('同名患者');
        if (!duplicateNames.includes(item.patientName)) {
          duplicateNames.push(item.patientName);
        }
      }
      seenNames.add(item.patientName);

      const existingPatient = patientStore.findByName(item.patientName);
      if (existingPatient.length > 0 && item.patientName) {
        item.isDuplicateName = true;
        item.warnings.push('系统中已存在同名患者');
      }

      const existingCase = patientStore.findByCaseNumber(item.caseNumber);
      if (existingCase && item.caseNumber) {
        item.isDuplicateCase = true;
        item.warnings.push('系统中已存在该病例号');
      }

      if (!item.hasDoctor) {
        item.warnings.push('缺少医生信息');
      }

      items.push(item);
    });

    items.forEach(item => {
      if (duplicateNames.includes(item.patientName)) {
        item.isDuplicateName = true;
        if (!item.warnings.includes('同名患者')) {
          item.warnings.push('同名患者');
        }
      }
      if (duplicateCases.includes(item.caseNumber)) {
        item.isDuplicateCase = true;
        if (!item.errors.includes('病例号重复')) {
          item.errors.push('病例号重复');
        }
      }
    });

    setBatchItems(items);
  };

  const batchStats = useMemo(() => {
    const total = batchItems.length;
    const errors = batchItems.filter(item => item.errors.length > 0).length;
    const warnings = batchItems.filter(item => item.warnings.length > 0 && item.errors.length === 0).length;
    const confirmed = batchItems.filter(item => item.confirmed).length;
    return { total, errors, warnings, confirmed };
  }, [batchItems]);

  const toggleItemConfirm = (id: string) => {
    setBatchItems(prev => prev.map(item =>
      item.id === id ? { ...item, confirmed: !item.confirmed } : item
    ));
  };

  const selectAllConfirm = () => {
    const hasErrorItems = batchItems.filter(item => item.errors.length > 0);
    if (hasErrorItems.length > 0) {
      if (!confirm(`存在 ${hasErrorItems.length} 条错误记录，是否跳过错误记录并全选其他记录？`)) {
        return;
      }
    }
    setBatchItems(prev => prev.map(item => ({
      ...item,
      confirmed: item.errors.length === 0,
    })));
  };

  const handleBatchSubmit = () => {
    const confirmedItems = batchItems.filter(item => item.confirmed);
    if (confirmedItems.length === 0) {
      alert('请先选择要入库的记录');
      return;
    }

    const hasErrorItems = confirmedItems.filter(item => item.errors.length > 0);
    if (hasErrorItems.length > 0) {
      if (!confirm(`选中的记录中有 ${hasErrorItems.length} 条存在错误，是否继续？`)) {
        return;
      }
    }

    const batchId = generateId();
    let successCount = 0;

    confirmedItems.forEach(item => {
      try {
        const existingDoctor = getExistingDoctorInfo(item.caseNumber);
        const inputDoctor = item.doctor.trim();
        const finalDoctor = inputDoctor || existingDoctor || '';
        const hasDoctor = !!finalDoctor;

        let patientId = '';
        const existingPatient = patientStore.findByCaseNumber(item.caseNumber);

        if (existingPatient) {
          patientId = existingPatient.id;
          if (finalDoctor && !existingPatient.doctor) {
            patientStore.update(existingPatient.id, { doctor: finalDoctor });
          }
        } else {
          const newPatient = patientStore.create({
            name: item.patientName,
            caseNumber: item.caseNumber,
            doctor: finalDoctor || undefined,
            phone: item.phone.trim() || undefined,
          });
          patientId = newPatient.id;
        }

        const arrivedPairs = parseInt(item.arrivedPairs) || 0;
        const totalPairs = parseInt(item.totalPairs) || arrivedPairs;

        alignerStore.create({
          patientId,
          patientName: item.patientName,
          caseNumber: item.caseNumber,
          stageNumber: item.stageNumber,
          totalPairs,
          arrivedPairs,
          status: 'pending',
          manufacturer: item.manufacturer.trim() || '未知厂家',
          arrivedDate: new Date().toISOString(),
          remark: item.remark.trim() || undefined,
          hasDoctorInfo: hasDoctor,
          needDoctorInfo: !hasDoctor,
          isBatch: true,
          batchId,
          originalArrivedPairs: arrivedPairs,
        });

        successCount++;
      } catch (error) {
        console.error('Failed to process item:', item, error);
      }
    });

    setSuccessMessage(`批量入库完成：成功 ${successCount} 条`);
    setTimeout(() => setSuccessMessage(''), 3000);

    setBatchText('');
    setBatchItems([]);
    loadPendingList();
    loadPendingDoctorList();
    onShelfChange?.();
  };

  const handleEditDoctor = (aligner: Aligner) => {
    setEditingAligner(aligner);
    setDoctorInput('');
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = () => {
    if (!editingAligner) return;
    if (!doctorInput.trim()) {
      alert('请输入医生姓名');
      return;
    }

    const patient = patientStore.getById(editingAligner.patientId);
    if (patient) {
      patientStore.update(patient.id, { doctor: doctorInput.trim() });
    }

    const patientAligners = alignerStore.getAll().filter(
      a => a.patientId === editingAligner.patientId
    );
    patientAligners.forEach(a => {
      if (a.needDoctorInfo || !a.hasDoctorInfo) {
        alignerStore.update(a.id, {
          hasDoctorInfo: true,
          needDoctorInfo: false,
        });
      }
    });

    setShowDoctorModal(false);
    setEditingAligner(null);
    setDoctorInput('');
    loadPendingDoctorList();
    loadPendingList();
    onShelfChange?.();

    setSuccessMessage(`已为 ${editingAligner.patientName} 补录医生：${doctorInput.trim()}，共更新 ${patientAligners.length} 条牙套记录`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const getRowClassName = (item: BatchStockInItem) => {
    if (item.errors.length > 0) return 'batch-row-error';
    if (item.isDuplicateName) return 'batch-row-warning';
    if (!item.hasDoctor) return 'batch-row-orange';
    return '';
  };

  const getValidationTags = (item: BatchStockInItem) => {
    const tags = [];
    if (item.isDuplicateName) {
      tags.push(<span key="name" className="validation-tag tag-yellow">同名</span>);
    }
    if (item.isDuplicateCase) {
      tags.push(<span key="case" className="validation-tag tag-red">重复病例号</span>);
    }
    if (!item.hasDoctor) {
      tags.push(<span key="doctor" className="validation-tag tag-orange">缺医生</span>);
    }
    return tags;
  };

  const renderSingleTab = () => (
    <div className="page-grid">
      <div className="form-section">
        <div className="section-card">
          <div className="section-title">
            <span className="title-icon">📝</span>
            <h3>入库登记</h3>
          </div>

          <div className="scan-input-wrapper">
            <label>扫码录入</label>
            <input
              type="text"
              className="scan-input"
              placeholder="扫描条码或手动输入 (格式：病例号-姓名-阶段)"
              onKeyDown={handleScanInput}
            />
            <p className="input-hint">支持扫码枪快速录入，按回车解析</p>
          </div>

          <form onSubmit={handleSubmit} className="stock-form">
            <div className="form-row">
              <div className="form-group">
                <label>患者姓名 <span className="required">*</span></label>
                <input
                  type="text"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  placeholder="请输入患者姓名"
                  className={showDuplicateWarning ? 'warning-input' : ''}
                />
                {showDuplicateWarning && (
                  <div className="warning-message">
                    ⚠️ 系统中已存在同名患者：
                    {duplicateCheck.patients.map(p => (
                      <span key={p.id} className="patient-tag">
                        {p.name} ({p.caseNumber})
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>病例号 <span className="required">*</span></label>
                <input
                  type="text"
                  name="caseNumber"
                  value={formData.caseNumber}
                  onChange={handleInputChange}
                  placeholder="请输入病例号"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>阶段编号 <span className="required">*</span></label>
                <input
                  type="text"
                  name="stageNumber"
                  value={formData.stageNumber}
                  onChange={handleInputChange}
                  placeholder="如：第1期 / 第2阶段"
                />
              </div>
              <div className="form-group">
                <label>厂家</label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleInputChange}
                  placeholder="如：隐适美、时代天使"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>到牙套数</label>
                <input
                  type="number"
                  name="arrivedPairs"
                  value={formData.arrivedPairs}
                  onChange={handleInputChange}
                  placeholder="到货副数"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>总副数</label>
                <input
                  type="number"
                  name="totalPairs"
                  value={formData.totalPairs}
                  onChange={handleInputChange}
                  placeholder="该阶段总副数"
                  min="0"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>主治医生</label>
                <input
                  type="text"
                  name="doctor"
                  value={formData.doctor}
                  onChange={handleInputChange}
                  placeholder="请输入主治医生姓名（非必填）"
                />
                {!formData.doctor.trim() && (
                  <div className="hint-message">
                    💡 未填写医生信息将自动标记为"待补医生"
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>联系电话</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="患者联系电话"
                />
              </div>
            </div>

            <div className="form-group">
              <label>备注</label>
              <textarea
                name="remark"
                value={formData.remark}
                onChange={handleInputChange}
                placeholder="特殊情况说明"
                rows={2}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                确认入库
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="list-section">
        <div className="section-card">
          <div className="section-title">
            <span className="title-icon">📦</span>
            <h3>待上架清单</h3>
            <span className="badge">{pendingList.length}</span>
          </div>

          {pendingList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>暂无待上架牙套</p>
            </div>
          ) : (
            <div className="pending-list">
              {pendingList.map(aligner => (
                <div key={aligner.id} className="pending-item">
                  <div className="pending-main">
                    <div className="patient-info">
                      <span className="patient-name">{aligner.patientName}</span>
                      <span className="case-number">{aligner.caseNumber}</span>
                    </div>
                    <div className="stage-info">
                      <span className="stage-badge">第{aligner.stageNumber}阶段</span>
                      <span className="pairs-info">{aligner.arrivedPairs}副</span>
                    </div>
                  </div>
                  <div className="pending-meta">
                    <span className="manufacturer">{aligner.manufacturer}</span>
                    <span className="date">
                      {new Date(aligner.arrivedDate).toLocaleDateString('zh-CN')}
                    </span>
                    {(!aligner.hasDoctorInfo || aligner.needDoctorInfo) && (
                      <span className="warning-tag need-doctor-tag">待补医生</span>
                    )}
                  </div>
                  <div className="pending-actions">
                    <button
                      className="btn-text btn-print"
                      onClick={() => handlePrintLabel(aligner)}
                    >
                      打印标签
                    </button>
                    <button
                      className="btn-text btn-danger"
                      onClick={() => handleDelete(aligner.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderBatchTab = () => (
    <div className="batch-section">
      <div className="section-card">
        <div className="section-title">
          <span className="title-icon">📋</span>
          <h3>批量入库</h3>
          <button
            type="button"
            className="btn-text"
            onClick={() => setShowBatchExample(!showBatchExample)}
          >
            {showBatchExample ? '隐藏示例' : '查看示例'}
          </button>
        </div>

        {showBatchExample && (
          <div className="example-box">
            <h4>格式说明</h4>
            <div className="example-content">
              <p><strong>格式1（表格格式）：</strong>每行用制表符(Tab)或逗号分隔</p>
              <div className="example-code">
                患者姓名	病例号	阶段编号	到货副数	总副数	厂家	主治医生	联系电话	备注<br />
                张三	2024001	1	10	20	隐适美	李医生	13800138000	优先处理<br />
                李四	2024002	2	15	15	时代天使	王医生	13900139000	
              </div>
              <p><strong>格式2（条码格式）：</strong>病例号-姓名-阶段-其他</p>
              <div className="example-code">
                2024001-张三-1-其他信息<br />
                2024002-李四-2-备注内容
              </div>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>粘贴数据</label>
          <textarea
            className="batch-textarea"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder="请粘贴数据，支持制表符分隔、逗号分隔的表格格式，或条码格式（病例号-姓名-阶段）"
            rows={8}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={parseBatchText}
          >
            解析数据
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setBatchText('');
              setBatchItems([]);
            }}
          >
            清空
          </button>
        </div>
      </div>

      {batchItems.length > 0 && (
        <div className="section-card">
          <div className="section-title">
            <span className="title-icon">✅</span>
            <h3>解析结果</h3>
            <div className="batch-stats">
              <span className="stat-item stat-total">总数：{batchStats.total}</span>
              <span className="stat-item stat-error">错误：{batchStats.errors}</span>
              <span className="stat-item stat-warning">警告：{batchStats.warnings}</span>
              <span className="stat-item stat-confirmed">已选：{batchStats.confirmed}</span>
            </div>
          </div>

          <div className="batch-table-wrapper">
            <table className="batch-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>
                    <input
                      type="checkbox"
                      checked={batchItems.length > 0 && batchItems.every(item => item.confirmed || item.errors.length > 0)}
                      onChange={selectAllConfirm}
                      title="全选无错误记录"
                    />
                  </th>
                  <th style={{ width: '60px' }}>行号</th>
                  <th>患者姓名</th>
                  <th>病例号</th>
                  <th>阶段</th>
                  <th>副数</th>
                  <th>厂家</th>
                  <th>医生</th>
                  <th>电话</th>
                  <th>校验</th>
                </tr>
              </thead>
              <tbody>
                {batchItems.map(item => (
                  <tr key={item.id} className={getRowClassName(item)}>
                    <td>
                      <input
                        type="checkbox"
                        checked={item.confirmed}
                        onChange={() => toggleItemConfirm(item.id)}
                        disabled={item.errors.length > 0}
                      />
                    </td>
                    <td>{item.rowNumber}</td>
                    <td className={item.isDuplicateName ? 'text-yellow' : ''}>
                      {item.patientName || <span className="text-muted">-</span>}
                    </td>
                    <td className={item.isDuplicateCase ? 'text-red' : ''}>
                      {item.caseNumber || <span className="text-muted">-</span>}
                    </td>
                    <td>{item.stageNumber || <span className="text-muted">-</span>}</td>
                    <td>{item.arrivedPairs || <span className="text-muted">-</span>}</td>
                    <td>{item.manufacturer || <span className="text-muted">-</span>}</td>
                    <td className={!item.hasDoctor ? 'text-orange' : ''}>
                      {item.doctor || <span className="text-muted">-</span>}
                    </td>
                    <td>{item.phone || <span className="text-muted">-</span>}</td>
                    <td>
                      <div className="validation-tags">
                        {getValidationTags(item)}
                        {item.errors.map((err, idx) => (
                          <span key={`err-${idx}`} className="validation-tag tag-red">{err}</span>
                        ))}
                        {item.warnings.filter(w => w !== '同名患者' && w !== '缺少医生信息').map((warn, idx) => (
                          <span key={`warn-${idx}`} className="validation-tag tag-yellow">{warn}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={selectAllConfirm}
            >
              全选确认（跳过错误）
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBatchSubmit}
              disabled={batchStats.confirmed === 0}
            >
              批量入库 ({batchStats.confirmed} 条)
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderPendingDoctorTab = () => (
    <div className="pending-doctor-section">
      <div className="section-card">
        <div className="section-title">
          <span className="title-icon">👨‍⚕️</span>
          <h3>待补医生</h3>
          <span className="badge">{pendingDoctorList.length}</span>
        </div>

        {pendingDoctorList.length === 0 ? (
          <div className="empty-state large">
            <div className="empty-icon">✅</div>
            <p>暂无待补医生的记录</p>
            <p className="empty-hint">所有牙套记录都已完善医生信息</p>
          </div>
        ) : (
          <div className="pending-doctor-list">
            {pendingDoctorList.map(aligner => (
              <div key={aligner.id} className="pending-doctor-item">
                <div className="doctor-item-main">
                  <div className="patient-info">
                    <span className="patient-name">{aligner.patientName}</span>
                    <span className="case-number">{aligner.caseNumber}</span>
                  </div>
                  <div className="stage-info">
                    <span className="stage-badge">第{aligner.stageNumber}阶段</span>
                    <span className="pairs-info">{aligner.arrivedPairs}副</span>
                  </div>
                </div>
                <div className="doctor-item-meta">
                  <span className="manufacturer">{aligner.manufacturer}</span>
                  <span className="date">
                    到货时间：{new Date(aligner.arrivedDate).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="warning-tag need-doctor-tag">待补医生</span>
                </div>
                <div className="doctor-item-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleEditDoctor(aligner)}
                  >
                    补录医生
                  </button>
                  <button
                    className="btn-text btn-danger"
                    onClick={() => handleDelete(aligner.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="stock-in-page">
      {successMessage && (
        <div className="success-banner">
          ✓ {successMessage}
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          单个入库
        </button>
        <button
          className={`tab ${activeTab === 'batch' ? 'active' : ''}`}
          onClick={() => setActiveTab('batch')}
        >
          批量入库
        </button>
        <button
          className={`tab ${activeTab === 'pending-doctor' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending-doctor')}
        >
          待补医生
          {pendingDoctorList.length > 0 && (
            <span className="tab-badge">{pendingDoctorList.length}</span>
          )}
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'single' && renderSingleTab()}
        {activeTab === 'batch' && renderBatchTab()}
        {activeTab === 'pending-doctor' && renderPendingDoctorTab()}
      </div>

      {showLabelModal && selectedAligner && (
        <LabelPrintModal
          aligner={selectedAligner}
          onClose={() => {
            setShowLabelModal(false);
            setSelectedAligner(null);
          }}
        />
      )}

      {showDoctorModal && editingAligner && (
        <div className="modal-overlay" onClick={() => setShowDoctorModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>补录医生信息</h3>
              <button className="close-btn" onClick={() => setShowDoctorModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="aligner-summary">
                <div className="summary-grid">
                  <div>
                    <span className="summary-label">患者姓名</span>
                    <span className="summary-value">{editingAligner.patientName}</span>
                  </div>
                  <div>
                    <span className="summary-label">病例号</span>
                    <span className="summary-value">{editingAligner.caseNumber}</span>
                  </div>
                  <div>
                    <span className="summary-label">阶段</span>
                    <span className="summary-value">第{editingAligner.stageNumber}阶段</span>
                  </div>
                  <div>
                    <span className="summary-label">到货时间</span>
                    <span className="summary-value">
                      {new Date(editingAligner.arrivedDate).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>主治医生姓名 <span className="required">*</span></label>
                <input
                  type="text"
                  value={doctorInput}
                  onChange={(e) => setDoctorInput(e.target.value)}
                  placeholder="请输入主治医生姓名"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDoctorModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveDoctor}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockInPage;
