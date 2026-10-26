import { useState, ChangeEvent } from 'react';
import {
  IconCheckCircle,
  IconTrash,
  IconUpload
} from '../icons/Icons';
import {
  FooterPositionPreset,
  TargetPageOption,
} from '../../utils/pdfHelper';

export interface FooterDisplayOptions {
  showQr: boolean;
  showSignerName: boolean;
  showOrganization: boolean;
  showTimestamp: boolean;
}

interface FooterConfigPanelProps {
  pdfFile: File | null;
  pageCount: number;
  targetPageOption: TargetPageOption;
  onChangeTargetPageOption: (opt: TargetPageOption) => void;
  specificStartPage: number;
  specificEndPage: number;
  onChangeSpecificStartPage: (page: number) => void;
  onChangeSpecificEndPage: (page: number) => void;
  positionPreset: FooterPositionPreset;
  onChangePositionPreset: (preset: FooterPositionPreset) => void;
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
}

export function FooterConfigPanel({
  pdfFile,
  pageCount,
  targetPageOption,
  onChangeTargetPageOption,
  specificStartPage,
  specificEndPage,
  onChangeSpecificStartPage,
  onChangeSpecificEndPage,
  positionPreset,
  onChangePositionPreset,
  displayOptions,
  onChangeDisplayOptions,
  stampFile,
  onSelectStamp,
  onRemoveStamp,
  signerName,
  organization,
  adminTargetNik,
  onChangeAdminTargetNik,
  isAdmin,
  isUserView,
  onSubmitSign,
  onReset,
  isValid,
}: FooterConfigPanelProps) {
  const [stampError, setStampError] = useState<string | null>(null);

  const isSpecificPageInvalid =
    targetPageOption === 'specific' &&
    (specificStartPage < 1 ||
     specificEndPage > pageCount ||
     specificStartPage > specificEndPage);

  const handleStampChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStampError(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpg|jpeg)$/i)) {
        setStampError('Gambar tanda tangan harus berformat PNG atau JPG.');
        return;
      }
      onSelectStamp(file);
    }
  };

  return (
    <div className="tte-config-panel">
      {/* Langkah 2: Pilih Halaman untuk Footer */}
      <div className="tte-step-card">
        <div className="tte-step-header">
          <span className="tte-step-badge">2</span>
          <div>
            <h2 className="tte-step-title">Pilih Halaman untuk Footer</h2>
            <p className="tte-step-desc">Tentukan halaman tempat footer TTE akan dibubuhkan</p>
          </div>
        </div>

        <div className="tte-page-options-grid" role="radiogroup" aria-label="Pilihan Halaman Footer">
          <label className={`tte-radio-card ${targetPageOption === 'last' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="target-page-opt"
              checked={targetPageOption === 'last'}
              onChange={() => onChangeTargetPageOption('last')}
            />
            <div className="tte-radio-content">
              <strong>Halaman Terakhir</strong>
              <span>
                {pdfFile ? `Hanya pada halaman ${pageCount}` : 'Halaman penutup dokumen'}
              </span>
            </div>
          </label>

          <label className={`tte-radio-card ${targetPageOption === 'all' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="target-page-opt"
              checked={targetPageOption === 'all'}
              onChange={() => onChangeTargetPageOption('all')}
            />
            <div className="tte-radio-content">
              <strong>Semua Halaman</strong>
              <span>Setiap lembar dokumen ({pageCount || 1} halaman)</span>
            </div>
          </label>

          <label className={`tte-radio-card ${targetPageOption === 'specific' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="target-page-opt"
              checked={targetPageOption === 'specific'}
              onChange={() => onChangeTargetPageOption('specific')}
            />
            <div className="tte-radio-content">
              <strong>Halaman Tertentu</strong>
              <span>Pilih nomor lembar spesifik</span>
            </div>
          </label>
        </div>

        {/* Input rentang halaman spesifik jika dipilih */}
        {targetPageOption === 'specific' && (
          <div className="tte-specific-page-box">
            <label className="input-label" htmlFor="specific-start-page-input">
              Rentang Halaman Target (1 s.d. {pageCount})
            </label>
            <div className="tte-specific-page-input-row">
              <span className="tte-range-label">Mulai</span>
              <input
                id="specific-start-page-input"
                type="number"
                min={1}
                max={pageCount || 1}
                className={`form-control ${isSpecificPageInvalid ? 'is-invalid' : ''}`}
                value={specificStartPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onChangeSpecificStartPage(isNaN(val) ? 1 : val);
                }}
                aria-label="Halaman awal target"
              />
              <span className="tte-range-label">sampai</span>
              <input
                id="specific-end-page-input"
                type="number"
                min={1}
                max={pageCount || 1}
                className={`form-control ${isSpecificPageInvalid ? 'is-invalid' : ''}`}
                value={specificEndPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onChangeSpecificEndPage(isNaN(val) ? (pageCount || 1) : val);
                }}
                aria-label="Halaman akhir target"
              />
              <span className="tte-specific-page-helper">dari total {pageCount} halaman</span>
            </div>

            {isSpecificPageInvalid && (
              <p id="page-validation-hint" className="tte-error-text" role="alert">
                Rentang halaman tidak valid (pastikan antara 1 s.d. {pageCount} dan halaman awal tidak melebihi halaman akhir).
              </p>
            )}
          </div>
        )}
      </div>

      {/* Langkah 3: Atur Footer TTE */}
      <div className="tte-step-card">
        <div className="tte-step-header">
          <span className="tte-step-badge">3</span>
          <div>
            <h2 className="tte-step-title">Atur Footer TTE</h2>
            <p className="tte-step-desc">Sesuaikan posisi dan elemen visual verifikasi tanda tangan</p>
          </div>
        </div>

        {/* Pilihan Posisi Preset */}
        <div className="tte-form-group">
          <label className="input-label">Pilihan Posisi Footer</label>
          <div className="tte-presets-row" role="radiogroup" aria-label="Pilihan Posisi Footer">
            <button
              type="button"
              className={`tte-preset-btn ${positionPreset === 'bottom-left' ? 'is-active' : ''}`}
              onClick={() => onChangePositionPreset('bottom-left')}
            >
              Bawah Kiri
            </button>
            <button
              type="button"
              className={`tte-preset-btn ${positionPreset === 'bottom-center' ? 'is-active' : ''}`}
              onClick={() => onChangePositionPreset('bottom-center')}
            >
              Bawah Tengah
            </button>
            <button
              type="button"
              className={`tte-preset-btn ${positionPreset === 'bottom-right' ? 'is-active' : ''}`}
              onClick={() => onChangePositionPreset('bottom-right')}
            >
              Bawah Kanan
            </button>
          </div>
        </div>

        {/* Elemen Informasi yang Ditampilkan pada Footer */}
        <div className="tte-form-group">
          <label className="input-label">Informasi pada Footer</label>
          <div className="tte-checkbox-list">
            <label className="tte-checkbox-item">
              <input
                type="checkbox"
                checked={displayOptions.showQr}
                onChange={(e) =>
                  onChangeDisplayOptions({ ...displayOptions, showQr: e.target.checked })
                }
              />
              <span>QR code verifikasi keaslian dokumen</span>
            </label>

            <label className="tte-checkbox-item">
              <input
                type="checkbox"
                checked={displayOptions.showSignerName}
                onChange={(e) =>
                  onChangeDisplayOptions({ ...displayOptions, showSignerName: e.target.checked })
                }
              />
              <span>Nama penandatangan ({signerName})</span>
            </label>

            <label className="tte-checkbox-item">
              <input
                type="checkbox"
                checked={displayOptions.showOrganization}
                onChange={(e) =>
                  onChangeDisplayOptions({ ...displayOptions, showOrganization: e.target.checked })
                }
              />
              <span>Organisasi / Unit ({organization})</span>
            </label>

            <label className="tte-checkbox-item">
              <input
                type="checkbox"
                checked={displayOptions.showTimestamp}
                onChange={(e) =>
                  onChangeDisplayOptions({ ...displayOptions, showTimestamp: e.target.checked })
                }
              />
              <span>Waktu penandatanganan (otomatis waktu sekarang)</span>
            </label>
          </div>
        </div>

        {/* Gambar Tanda Tangan (PNG/JPG) Opsional */}
        <div className="tte-form-group">
          <label className="input-label" htmlFor="stamp-file-input">
            Gambar tanda tangan (PNG/JPG) <span className="tte-label-optional">(Opsional)</span>
          </label>
          <p className="tte-hint-text">
            Representasi visual tanda tangan atau stempel basah. TTE kriptografis tetap sah walau tanpa gambar tanda tangan.
          </p>

          <input
            id="stamp-file-input"
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            onChange={handleStampChange}
            style={{ display: 'none' }}
          />

          {stampError && (
            <p className="tte-error-text" role="alert" style={{ marginBottom: '8px' }}>
              {stampError}
            </p>
          )}

          {!stampFile ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm tte-upload-stamp-btn"
              onClick={() => document.getElementById('stamp-file-input')?.click()}
            >
              <IconUpload size={15} aria-hidden="true" />
              <span>Pilih Gambar Tanda Tangan (PNG/JPG)</span>
            </button>
          ) : (
            <div className="tte-stamp-preview-card">
              <img
                src={URL.createObjectURL(stampFile)}
                alt="Pratinjau gambar tanda tangan"
                className="tte-stamp-thumb"
              />
              <div className="tte-stamp-meta">
                <span className="tte-stamp-name">{stampFile.name}</span>
                <span className="tte-stamp-size">{(stampFile.size / 1024).toFixed(1)} KB</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm tte-stamp-delete-btn"
                onClick={onRemoveStamp}
                title="Hapus gambar tanda tangan"
                aria-label="Hapus gambar tanda tangan"
              >
                <IconTrash size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Input NIK Khusus Admin jika menandatangani atas nama NIK lain */}
        {isAdmin && !isUserView && (
          <div className="tte-form-group" style={{ borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
            <label className="input-label" htmlFor="admin-target-nik-input">
              NIK Target Penandatangan <span className="tte-label-optional">(Khusus Admin)</span>
            </label>
            <input
              id="admin-target-nik-input"
              type="text"
              maxLength={16}
              className="form-control"
              placeholder="Kosongkan untuk NIK akun Anda sendiri"
              value={adminTargetNik}
              onChange={(e) => onChangeAdminTargetNik(e.target.value)}
            />
            <span className="tte-hint-text">
              Gunakan jika Admin menandatangani dokumen mewakili sertifikat pengguna terdaftar.
            </span>
          </div>
        )}

        {/* Kotak Edukasi TTE */}
        <div className="tte-edu-box">
          <p className="tte-edu-text">
            <strong>Catatan Keabsahan:</strong> Footer visual ini merupakan representasi tampilan informasi. Integritas dan keabsahan hukum dokumen dijamin melalui sertifikat digital yang disematkan didalam struktur berkas PDF.
          </p>
        </div>
      </div>

      {/* Ringkasan & Konfirmasi Tindakan */}
      <div className="tte-step-card tte-summary-card">
        <h3 className="tte-summary-title">Ringkasan Tindakan</h3>
        <ul className="tte-summary-list">
          <li>
            <span className="tte-summary-label">Dokumen:</span>
            <span className="tte-summary-val">{pdfFile ? pdfFile.name : 'Belum dipilih'}</span>
          </li>
          <li>
            <span className="tte-summary-label">Halaman Footer:</span>
            <span className="tte-summary-val">
              {targetPageOption === 'all'
                ? `Semua Halaman (1 – ${pageCount || 1})`
                : targetPageOption === 'last'
                ? `Halaman Terakhir (${pageCount || 1})`
                : specificStartPage === specificEndPage
                ? `Halaman ${specificStartPage}`
                : `Halaman ${specificStartPage} s.d. ${specificEndPage}`}
            </span>
          </li>
          <li>
            <span className="tte-summary-label">Penandatangan:</span>
            <span className="tte-summary-val">{signerName}</span>
          </li>
          <li>
            <span className="tte-summary-label">Posisi Footer:</span>
            <span className="tte-summary-val">
              {positionPreset === 'bottom-left'
                ? 'Bawah Kiri'
                : positionPreset === 'bottom-center'
                ? 'Bawah Tengah'
                : 'Bawah Kanan'}
            </span>
          </li>
        </ul>

        <div className="tte-actions-row">
          <button
            type="button"
            className="btn btn-primary btn-lg tte-submit-btn"
            disabled={!isValid || !pdfFile}
            onClick={onSubmitSign}
          >
            <IconCheckCircle size={18} aria-hidden="true" />
            <span>Tanda Tangani Dokumen</span>
          </button>

          {pdfFile && (
            <button
              type="button"
              className="btn btn-ghost tte-reset-btn"
              onClick={onReset}
            >
              Reset Konfigurasi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
