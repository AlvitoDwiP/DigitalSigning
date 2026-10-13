import { useState, useRef } from 'react';
import type { BulkGenerateData } from '../../types/users';
import { generateBulkUsers } from '../../services/users';
import { validateCsvContent, type ClientCsvValidationResult } from '../../utils/csvParser';
import { maskNik } from '../users/UsersTable';
import { StatusChip } from '../ui/StatusChip';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconRefresh,
  IconXCircle,
  IconUpload,
  IconFileText,
  IconCopy,
  IconShield,
} from '../icons/Icons';

interface GenerateBulkUserViewProps {
  onNavigateUsers: () => void;
}

export function GenerateBulkUserView({ onNavigateUsers }: GenerateBulkUserViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File & Client Validation state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ClientCsvValidationResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkGenerateData | null>(null);

  const processFile = (file: File) => {
    setParseError(null);
    setServerError(null);
    setBulkResult(null);

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Berkas harus berupa file format CSV (.csv).');
      setSelectedFile(null);
      setValidationResult(null);
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) {
        setParseError('Berkas CSV kosong atau tidak dapat dibaca.');
        setValidationResult(null);
        return;
      }

      const res = validateCsvContent(text);
      if (res.headerError) {
        setParseError(res.headerError);
      }
      setValidationResult(res);
    };

    reader.onerror = () => {
      setParseError('Gagal membaca isi berkas CSV.');
      setValidationResult(null);
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setSelectedFile(null);
      setValidationResult(null);
      return;
    }
    processFile(files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleCopyHeader = () => {
    navigator.clipboard.writeText('name,nik,email,organization,ou,password,pfx_pass');
    setCopiedHeader(true);
    setTimeout(() => setCopiedHeader(false), 2000);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setParseError(null);
    setServerError(null);
    setBulkResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitBulk = async () => {
    if (!selectedFile || !validationResult || validationResult.invalidCount > 0) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const res = await generateBulkUsers(selectedFile);
      if (res.success && res.data) {
        setBulkResult(res.data);
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal memproses batch penerbitan pengguna.');
        setServerError(msg);
      }
    } catch (err: any) {
      setServerError(err.message || 'Terjadi kesalahan saat memproses batch penerbitan massal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="generate-bulk-container">
      {/* 1. Informational Format Box */}
      <div className="bulk-guide-card">
        <div className="bulk-guide-header">
          <div className="bulk-guide-icon-badge">
            <IconFileText size={20} className="text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="bulk-guide-title">Format berkas CSV</h3>
            <p className="bulk-guide-subtitle">
              Pastikan berkas CSV memuat kolom berikut sesuai urutan untuk validasi data.
            </p>
          </div>
        </div>

        {/* Copyable Header Bar */}
        <div className="bulk-header-template-box">
          <div className="header-template-label">
            <span>Urutan baris header (salin untuk baris pertama):</span>
          </div>
          <div className="header-template-row">
            <div className="csv-contract-block font-mono" tabIndex={0} aria-label="Format Header CSV">
              <code>name,nik,email,organization,ou,password,pfx_pass</code>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-copy-header"
              onClick={handleCopyHeader}
              title="Salin baris header"
            >
              {copiedHeader ? (
                <>
                  <IconCheckCircle size={15} className="text-success" aria-hidden="true" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <IconCopy size={15} aria-hidden="true" />
                  <span>Salin format</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Important Rules Note Box */}
        <div className="csv-rules-notes">
          <div className="rules-note-icon">
            <IconShield size={16} aria-hidden="true" />
          </div>
          <div className="rules-note-text">
            <strong>Ketentuan format:</strong> NIK wajib 16 digit angka. Kata sandi minimal 8 karakter dengan minimal 1 huruf kapital dan 1 simbol. Passphrase (pfx_pass) minimal 8 karakter, atau dapat dikosongkan untuk otomatis menggunakan password basic.
          </div>
        </div>
      </div>

      {/* Global Errors */}
      {(parseError || serverError) && (
        <div className="generate-error-banner" role="alert">
          <IconAlertTriangle size={18} aria-hidden="true" />
          <span>{parseError || serverError}</span>
        </div>
      )}

      {/* 1. Results View if Bulk Completed */}
      {bulkResult ? (
        <div className="bulk-results-view" role="region" aria-label="Hasil Proses Batch">
          <div className="bulk-results-summary-card">
            <div className="results-summary-header">
              <h3 className="results-summary-title">Ringkasan hasil</h3>
              <p className="results-summary-desc">
                Berikut hasil pembuatan pengguna dan sertifikat digital.
              </p>
            </div>

            <div className="results-stat-badges-row">
              <div className="result-badge-item badge-total">
                <span className="badge-item-label">Total data</span>
                <span className="badge-item-number">{bulkResult.total}</span>
              </div>
              <div className="result-badge-item badge-success">
                <span className="badge-item-label">Berhasil</span>
                <span className="badge-item-number">{bulkResult.success}</span>
              </div>
              <div className="result-badge-item badge-failed">
                <span className="badge-item-label">Gagal</span>
                <span className="badge-item-number">{bulkResult.failed}</span>
              </div>
            </div>
          </div>

          <div className="bulk-results-table-card">
            <div className="results-table-header">
              <h4 className="results-table-title">Rincian per baris</h4>
            </div>

            <div className="bulk-table-responsive-wrapper" tabIndex={0} aria-label="Tabel Hasil Batch">
              <table className="bulk-preview-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '80px' }}>Baris</th>
                    <th scope="col">NIK</th>
                    <th scope="col" style={{ width: '120px' }}>Status</th>
                    <th scope="col">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResult.results.map((item) => (
                    <tr key={item.row} className="bulk-row">
                      <td className="font-mono">#{item.row}</td>
                      <td className="font-mono">{maskNik(item.nik)}</td>
                      <td>
                        <StatusChip
                          status={item.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED'}
                          label={item.status === 'SUCCESS' ? 'Berhasil' : 'Gagal'}
                        />
                      </td>
                      <td className="result-error-cell">
                        {item.status === 'SUCCESS' ? (
                          <span className="text-success flex-align-center">
                            <IconCheckCircle size={15} aria-hidden="true" />
                            <span>Pengguna dan sertifikat berhasil dibuat</span>
                          </span>
                        ) : (
                          <span className="text-danger flex-align-center">
                            <IconXCircle size={15} aria-hidden="true" />
                            <span>{item.error || 'Gagal dibuat'}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bulk-results-actions-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleReset}
              >
                <IconRefresh size={16} aria-hidden="true" />
                <span>Pilih berkas lain</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={onNavigateUsers}
              >
                <span>Buka daftar pengguna</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 2. Upload and Preview View */
        <div className="bulk-upload-section">
          {/* File Upload Area */}
          <div className="file-upload-card">
            <div className="file-upload-header">
              <div className="file-upload-title-row">
                <IconUpload size={20} className="text-primary" aria-hidden="true" />
                <h3 className="file-upload-title">Pilih berkas CSV</h3>
              </div>
              <p className="file-upload-subtitle">
                Unggah berkas untuk pratinjau dan validasi otomatis sebelum proses pembuatan pengguna.
              </p>
            </div>

            <div
              className={`bulk-dropzone ${isDragging ? 'is-dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                id="csv-file-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="csv-hidden-input"
                aria-label="Pilih berkas CSV pengguna"
              />

              {!selectedFile ? (
                <div className="dropzone-empty-content">
                  <div className="dropzone-icon-circle">
                    <IconUpload size={28} className="text-primary" aria-hidden="true" />
                  </div>
                  <div className="dropzone-text-group">
                    <p className="dropzone-prompt">
                      Seret dan lepas berkas CSV ke sini, atau
                    </p>
                    <label htmlFor="csv-file-upload" className="btn btn-primary btn-choose-file">
                      <IconUpload size={16} aria-hidden="true" />
                      <span>Pilih berkas CSV</span>
                    </label>
                  </div>
                  <span className="dropzone-help-text">
                    Format berkas .csv dengan pemisah koma
                  </span>
                </div>
              ) : (
                <div className="dropzone-selected-content">
                  <div className="selected-file-info-box">
                    <div className="selected-file-icon">
                      <IconFileText size={26} className="text-primary" aria-hidden="true" />
                    </div>
                    <div className="selected-file-meta">
                      <span className="file-name-text font-mono">{selectedFile.name}</span>
                      <span className="file-size-text">
                        {Math.ceil(selectedFile.size / 1024)} KB &bull; Berkas siap divalidasi
                      </span>
                    </div>
                  </div>
                  <div className="selected-file-actions">
                    <label htmlFor="csv-file-upload" className="btn btn-ghost btn-change-file">
                      <span>Ganti berkas</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-remove-file"
                      onClick={handleReset}
                      title="Batalkan pilihan berkas"
                    >
                      <IconXCircle size={16} aria-hidden="true" />
                      <span>Batal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Validation and Preview Card */}
          {validationResult && (
            <div className="bulk-preview-card" role="region" aria-label="Pratinjau Data CSV">
              <div className="preview-card-header">
                <div className="preview-summary-left">
                  <h4 className="preview-card-title">Pratinjau data pengguna</h4>
                  <p className="preview-card-subtitle">
                    Periksa data sebelum diproses. Kata sandi tidak ditampilkan pada pratinjau.
                  </p>
                </div>

                <div className="preview-counts-badges">
                  <span className="count-badge badge-total">
                    Total: <strong>{validationResult.totalRows}</strong>
                  </span>
                  <span className="count-badge badge-valid">
                    Valid: <strong>{validationResult.validCount}</strong>
                  </span>
                  {validationResult.invalidCount > 0 && (
                    <span className="count-badge badge-invalid">
                      Tidak valid: <strong>{validationResult.invalidCount}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Table Preview */}
              <div className="bulk-table-responsive-wrapper" tabIndex={0} aria-label="Tabel Pratinjau CSV">
                <table className="bulk-preview-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '70px' }}>Baris</th>
                      <th scope="col">Nama</th>
                      <th scope="col">NIK</th>
                      <th scope="col">Email</th>
                      <th scope="col">Instansi / Unit kerja</th>
                      <th scope="col" style={{ width: '120px' }}>Validasi</th>
                      <th scope="col">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.rows.map((row) => (
                      <tr key={row.rowNumber} className={row.isValid ? 'row-valid' : 'row-invalid'}>
                        <td className="font-mono">#{row.rowNumber}</td>
                        <td className="user-name-text">{row.name}</td>
                        <td className="font-mono">{maskNik(row.nik)}</td>
                        <td>{row.email}</td>
                        <td>
                          {row.organization}
                          {row.ou && <span className="ou-subtext"> / {row.ou}</span>}
                        </td>
                        <td>
                          <StatusChip
                            status={row.isValid ? 'SUCCESS' : 'FAILED'}
                            label={row.isValid ? 'Valid' : 'Tidak valid'}
                          />
                        </td>
                        <td className="row-errors-cell">
                          {row.errors && row.errors.length > 0 ? (
                            <ul className="preview-errors-list">
                              {row.errors.map((err, errIdx) => (
                                <li key={errIdx}>{err}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Preview Footer / Submit */}
              <div className="preview-footer-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleReset}
                  disabled={isSubmitting}
                >
                  Pilih berkas lain
                </button>

                <div className="preview-submit-group">
                  {validationResult.invalidCount > 0 && (
                    <p className="invalid-warning-hint" role="note">
                      Ada data yang belum valid. Perbaiki berkas CSV dan unggah ulang sebelum memproses.
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-process-bulk"
                    onClick={handleSubmitBulk}
                    disabled={isSubmitting || validationResult.invalidCount > 0}
                  >
                    {isSubmitting
                      ? 'Memproses...'
                      : `Buat ${validationResult.validCount} pengguna`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
