import { useState, ChangeEvent, DragEvent } from 'react';
import {
  IconCheckCircle,
  IconTrash,
  IconUpload,
  IconRefresh,
  IconEye,
  IconEyeOff,
  IconQrCode,
  IconImage,
  IconMove,
} from '../icons/Icons';
import {
  SignatureMode,
  SignatureVisualType,
  SignaturePlacement,
  FooterPositionPreset,
} from '../../utils/pdfHelper';

export interface FooterDisplayOptions {
  showQr: boolean;
  showSignerName: boolean;
  showOrganization: boolean;
  showTimestamp: boolean;
}

export interface FooterConfigPanelProps {
  pdfFile: File | null;
  pageCount: number;
  signatureMode: SignatureMode;
  onChangeSignatureMode: (mode: SignatureMode) => void;
  targetPage: number;
  onChangeTargetPage: (page: number) => void;
  visualType: SignatureVisualType;
  onChangeVisualType: (type: SignatureVisualType) => void;
  placement: SignaturePlacement;
  onChangePlacement: (placement: SignaturePlacement) => void;
  onPresetSelect: (preset: FooterPositionPreset) => void;
  displayOptions: FooterDisplayOptions;
  onChangeDisplayOptions: (opts: FooterDisplayOptions) => void;
  stampFile: File | null;
  onSelectStamp: (file: File) => void;
  onRemoveStamp: () => void;
  signerName: string;
  organization: string;
  adminTargetNik: string;
  onChangeAdminTargetNik: (nik: string) => void;
  isAdmin: boolean;
  isUserView: boolean;
  onSubmitSign: () => void;
  onReset: () => void;
  isValid: boolean;
  onGoToPreview?: () => void;
  // Props kompatibilitas opsional
  targetPageOption?: any;
  onChangeTargetPageOption?: any;
  specificStartPage?: any;
  specificEndPage?: any;
  onChangeSpecificStartPage?: any;
  onChangeSpecificEndPage?: any;
  positionPreset?: any;
  onChangePositionPreset?: any;
}

export function FooterConfigPanel({
  pdfFile,
  pageCount,
  signatureMode,
  onChangeSignatureMode,
  targetPage,
  onChangeTargetPage,
  visualType,
  onChangeVisualType,
  placement: _placement,
  onPresetSelect: _onPresetSelect,
  displayOptions: _displayOptions,
  onChangeDisplayOptions: _onChangeDisplayOptions,
  stampFile,
  onSelectStamp,
  onRemoveStamp,
  signerName: _signerName,
  organization: _organization,
  adminTargetNik: _adminTargetNik,
  onChangeAdminTargetNik: _onChangeAdminTargetNik,
  isAdmin: _isAdmin,
  isUserView: _isUserView,
  onSubmitSign,
  onReset,
  isValid,
  onGoToPreview,
}: FooterConfigPanelProps) {
  const [stampError, setStampError] = useState<string | null>(null);
  const [isStampDragOver, setIsStampDragOver] = useState(false);

  const validateAndSelectStamp = (file: File) => {
    setStampError(null);
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpg|jpeg)$/i)) {
      setStampError('Gambar tanda tangan harus berformat PNG atau JPG.');
      return;
    }
    onSelectStamp(file);
  };

  const handleStampChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelectStamp(e.target.files[0]);
    }
  };

  const handleStampDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsStampDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectStamp(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="tte-config-panel">
      {/* Langkah 2: Pilih Mode Tanda Tangan (Visible / Invisible & Pilihan Format Visual) */}
      <div className="tte-step-card">
        <div className="tte-step-header">
          <span className="tte-step-badge">2</span>
          <div>
            <h2 className="tte-step-title">Mode Tanda Tangan (TTE)</h2>
            <p className="tte-step-desc">Pilih mode visibilitas dan format tampilan tanda tangan</p>
          </div>
        </div>

        <div className="tte-mode-cards-grid" role="radiogroup" aria-label="Pilihan Mode TTE">
          <label className={`tte-mode-card ${signatureMode === 'visible' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="tte-signature-mode"
              checked={signatureMode === 'visible'}
              onChange={() => onChangeSignatureMode('visible')}
            />
            <div className="tte-mode-card-icon">
              <IconEye size={20} />
            </div>
            <div className="tte-mode-card-content">
              <strong>TTE Terlihat (Visible)</strong>
              <span>Stempel QR / Paraf pada dokumen.</span>
            </div>
          </label>

          <label className={`tte-mode-card ${signatureMode === 'invisible' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="tte-signature-mode"
              checked={signatureMode === 'invisible'}
              onChange={() => onChangeSignatureMode('invisible')}
            />
            <div className="tte-mode-card-icon">
              <IconEyeOff size={20} />
            </div>
            <div className="tte-mode-card-content">
              <strong>TTE Tak Terlihat (Invisible)</strong>
              <span>Kriptografis tanpa visual di PDF.</span>
            </div>
          </label>
        </div>

        {/* Pilihan Format Visual di dalam kartu Mode Tanda Tangan (saat Visible aktif) */}
        {signatureMode === 'visible' && (
          <div className="tte-form-group" style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--line)' }}>
            <label className="input-label">Pilihan Format Visual:</label>
            <div className="tte-visual-type-toggle" role="tablist">
              <button
                type="button"
                className={`tte-visual-type-btn ${visualType === 'qr_text' ? 'is-active' : ''}`}
                onClick={() => onChangeVisualType('qr_text')}
                role="tab"
                aria-selected={visualType === 'qr_text'}
              >
                <IconQrCode size={16} />
                <span>QR Code</span>
              </button>
              <button
                type="button"
                className={`tte-visual-type-btn ${visualType === 'image' ? 'is-active' : ''}`}
                onClick={() => onChangeVisualType('image')}
                role="tab"
                aria-selected={visualType === 'image'}
              >
                <IconImage size={16} />
                <span>Gambar Tanda Tangan / Paraf</span>
              </button>
            </div>

            {visualType === 'image' && (
              <div style={{ marginTop: '6px' }}>
                <input
                  id="stamp-file-input"
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={handleStampChange}
                  style={{ display: 'none' }}
                />

                {stampError && (
                  <p className="tte-error-text" role="alert" style={{ marginBottom: '6px' }}>
                    {stampError}
                  </p>
                )}

                {!stampFile ? (
                  <div
                    className={`tte-dropzone tte-stamp-dropzone ${isStampDragOver ? 'is-drag-over' : ''}`}
                    onClick={() => document.getElementById('stamp-file-input')?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsStampDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsStampDragOver(false);
                    }}
                    onDrop={handleStampDrop}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        document.getElementById('stamp-file-input')?.click();
                      }
                    }}
                    aria-label="Area unggah gambar tanda tangan"
                  >
                    <div className="tte-dropzone-icon-wrap" aria-hidden="true">
                      <IconUpload size={22} />
                    </div>
                    <div className="tte-dropzone-texts">
                      <strong className="tte-dropzone-main">Pilih Gambar atau seret berkas ke sini</strong>
                      <span className="tte-dropzone-hint">PNG / JPG · Maksimal 5 MB</span>
                    </div>
                  </div>
                ) : (
                  <div className="tte-file-card">
                    <img
                      src={URL.createObjectURL(stampFile)}
                      alt="Pratinjau gambar tanda tangan"
                      className="tte-stamp-thumb"
                    />
                    <div className="tte-file-meta">
                      <span className="tte-file-name" title={stampFile.name}>
                        {stampFile.name}
                      </span>
                      <div className="tte-file-details">
                        <span>{(stampFile.size / 1024).toFixed(1)} KB</span>
                        <span className="tte-file-dot" aria-hidden="true">•</span>
                        <span>Gambar Paraf</span>
                      </div>
                    </div>
                    <div className="tte-file-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm tte-file-action-btn"
                        onClick={() => document.getElementById('stamp-file-input')?.click()}
                        title="Ganti gambar tanda tangan"
                        aria-label="Ganti gambar tanda tangan"
                      >
                        <IconRefresh size={14} aria-hidden="true" />
                        <span>Ganti</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm tte-file-action-btn is-danger"
                        onClick={onRemoveStamp}
                        title="Hapus gambar tanda tangan"
                        aria-label="Hapus gambar tanda tangan"
                      >
                        <IconTrash size={14} aria-hidden="true" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Langkah 3: Halaman Target (Hanya 1 Halaman Saja) */}
      <div className="tte-step-card">
        <div className="tte-step-header">
          <span className="tte-step-badge">3</span>
          <div>
            <h2 className="tte-step-title">Pilih Satu Halaman Target</h2>
            <p className="tte-step-desc">TTE ditempatkan pada 1 halaman spesifik yang Anda tentukan</p>
          </div>
        </div>

        <div className="tte-page-compact-row">
          <div className="tte-page-quick-buttons" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`btn btn-sm ${targetPage === 1 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onChangeTargetPage(1)}
              disabled={!pdfFile}
            >
              Awal
            </button>
            {pageCount > 1 && (
              <button
                type="button"
                className={`btn btn-sm ${targetPage === pageCount ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onChangeTargetPage(pageCount)}
                disabled={!pdfFile}
              >
                Akhir
              </button>
            )}
          </div>

          <div className="tte-target-input-inline">
            <label className="tte-inline-page-label" htmlFor="target-single-page-input">
              Pilih Halaman:
            </label>
            <input
              id="target-single-page-input"
              type="number"
              min={0}
              max={pageCount || 1}
              className="form-control tte-inline-page-input"
              value={targetPage}
              onChange={(e) => {
                const valStr = e.target.value.trim();
                if (valStr === '') {
                  onChangeTargetPage(0);
                  return;
                }
                const val = parseInt(valStr, 10);
                if (!isNaN(val)) {
                  onChangeTargetPage(Math.min(Math.max(0, val), pageCount || 1));
                }
              }}
              disabled={!pdfFile}
            />
            <span className="tte-page-total-label">/ {pageCount || 1}</span>
          </div>
        </div>
      </div>

      {/* Tombol Pintas ke Pratinjau Lembar (Hanya Tampil di Mobile / Tablet) */}
      {onGoToPreview && (
        <button
          type="button"
          className="btn btn-secondary tte-mobile-preview-shortcut-wrap"
          onClick={onGoToPreview}
        >
          <IconMove size={15} aria-hidden="true" />
          <span>Atur & Lihat Posisi TTE di Pratinjau Lembar (Hal. {targetPage}) →</span>
        </button>
      )}

      {/* Tombol Aksi Penandatanganan */}
      <div className="tte-step-card tte-summary-card">
        <div className="tte-actions-row tte-actions-row-inline">
          <button
            type="button"
            className="btn btn-primary tte-submit-btn"
            disabled={!isValid || !pdfFile}
            onClick={onSubmitSign}
          >
            <IconCheckCircle size={17} aria-hidden="true" />
            <span>Tanda Tangani Dokumen</span>
          </button>

          {pdfFile && (
            <button
              type="button"
              className="btn btn-secondary tte-reset-btn-inline"
              onClick={onReset}
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
