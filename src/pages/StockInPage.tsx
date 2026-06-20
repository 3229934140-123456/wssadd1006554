import { useState, useEffect } from 'react';
import { patientStore, alignerStore } from '../store';
import type { Aligner, DuplicatePatientCheck } from '../types';
import LabelPrintModal from '../components/LabelPrintModal';

interface StockInPageProps {
  onShelfChange?: () => void;
}

function StockInPage({ onShelfChange }: StockInPageProps) {
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
  const [showDoctorWarning, setShowDoctorWarning] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedAligner, setSelectedAligner] = useState<Aligner | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadPendingList();
  }, []);

  const loadPendingList = () => {
    const pending = alignerStore.getPendingList();
    setPendingList(pending.sort((a, b) => 
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

    if (!formData.doctor.trim()) {
      setShowDoctorWarning(true);
      return;
    }
    setShowDoctorWarning(false);

    let patientId = '';
    const existingPatient = patientStore.findByCaseNumber(formData.caseNumber.trim());
    
    if (existingPatient) {
      patientId = existingPatient.id;
      if (formData.doctor.trim() && !existingPatient.doctor) {
        patientStore.update(existingPatient.id, { doctor: formData.doctor.trim() });
      }
    } else {
      const newPatient = patientStore.create({
        name: formData.patientName.trim(),
        caseNumber: formData.caseNumber.trim(),
        doctor: formData.doctor.trim() || undefined,
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
      hasDoctorInfo: !!formData.doctor.trim(),
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

    setSuccessMessage(`已登记：${newAligner.patientName} - 第${newAligner.stageNumber}阶段`);
    setTimeout(() => setSuccessMessage(''), 3000);

    loadPendingList();
    onShelfChange?.();
  };

  const handleQuickSubmit = () => {
    setShowDoctorWarning(false);
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const handlePrintLabel = (aligner: Aligner) => {
    setSelectedAligner(aligner);
    setShowLabelModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条入库记录吗？')) {
      alignerStore.delete(id);
      loadPendingList();
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

  return (
    <div className="stock-in-page">
      {successMessage && (
        <div className="success-banner">
          ✓ {successMessage}
        </div>
      )}

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
                  <label>主治医生 {showDoctorWarning && <span className="required">*</span>}</label>
                  <input
                    type="text"
                    name="doctor"
                    value={formData.doctor}
                    onChange={handleInputChange}
                    placeholder="请输入主治医生姓名"
                    className={showDoctorWarning ? 'warning-input' : ''}
                  />
                  {showDoctorWarning && (
                    <div className="warning-message">
                      ⚠️ 缺少医生信息，请确认是否继续？
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
                {showDoctorWarning && (
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={handleQuickSubmit}
                  >
                    缺少医生信息，仍要入库
                  </button>
                )}
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
                      {!aligner.hasDoctorInfo && (
                        <span className="warning-tag">缺医生</span>
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

export default StockInPage;
