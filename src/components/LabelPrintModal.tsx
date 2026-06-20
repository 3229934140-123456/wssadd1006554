import { useRef } from 'react';
import type { Aligner } from '../types';
import './LabelPrintModal.css';

interface LabelPrintModalProps {
  aligner: Aligner;
  onClose: () => void;
}

function LabelPrintModal({ aligner, onClose }: LabelPrintModalProps) {
  const labelRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = labelRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=400,height=300');
    if (!printWindow) {
      alert('请允许弹出窗口以进行打印');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>牙套标签</title>
        <style>
          @page {
            size: 60mm 40mm;
            margin: 2mm;
          }
          body {
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
            margin: 0;
            padding: 0;
          }
          .label {
            width: 56mm;
            height: 36mm;
            border: 1px solid #000;
            padding: 3mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .label-header {
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
            padding-bottom: 2mm;
          }
          .label-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 1mm;
          }
          .patient-name {
            font-size: 14px;
            font-weight: bold;
          }
          .case-number {
            font-size: 10px;
            color: #666;
          }
          .stage-info {
            font-size: 11px;
          }
          .label-footer {
            font-size: 9px;
            color: #999;
            text-align: right;
          }
          .location {
            font-size: 10px;
            background: #f0f0f0;
            padding: 1mm 2mm;
            text-align: center;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content label-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>打印标签</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="label-preview" ref={labelRef}>
            <div className="label">
              <div className="label-header">隐形矫治器</div>
              <div className="label-body">
                <div className="patient-name">{aligner.patientName}</div>
                <div className="case-number">病例号：{aligner.caseNumber}</div>
                <div className="stage-info">
                  第{aligner.stageNumber}阶段 · {aligner.arrivedPairs}副
                </div>
              </div>
              {aligner.cabinetNumber && (
                <div className="location">
                  柜位：{aligner.cabinetNumber}柜-{aligner.layerNumber}层-{aligner.cellNumber}格
                </div>
              )}
              <div className="label-footer">
                {new Date(aligner.arrivedDate).toLocaleDateString('zh-CN')}
              </div>
            </div>
          </div>
          
          <p className="print-hint">
            提示：请将标签纸放入打印机后点击打印
          </p>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handlePrint}>打印标签</button>
        </div>
      </div>
    </div>
  );
}

export default LabelPrintModal;
