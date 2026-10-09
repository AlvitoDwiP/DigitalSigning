import { useState, useRef } from 'react';
import type { BulkGenerateData } from '../../types/users';
import { generateBulkUsers } from '../../services/users';
import { validateCsvContent, type ClientCsvValidationResult } from '../../utils/csvParser';
import { maskNik } from '../users/UsersTable';
import { StatusChip } from '../ui/StatusChip';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconUsers,
  IconRefresh,
  IconXCircle,
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

  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkGenerateData | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setParseError(null);
    setServerError(null);
    setBulkResult(null);

    if (!files || files.length === 0) {
      setSelectedFile(null);
      setValidationResult(null);
      return;
    }

    const file = files[0];
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
      {/* Informational Header Box */}
      <div className="bulk-guide-card">
        <div className="bulk-guide-header">
          <IconUsers size={20} className="bulk-guide-icon" aria-hidden="true" />
          <h3 className="bulk-guide-title">Format dan Struktur Berkas CSV</h3>
        </div>
        <p className="bulk-guide-text">
          Berkas CSV wajib terdiri dari <strong>7 kolom</strong> sesuai urutan berikut:
        </p>
        <div className="csv-contract-block font-mono" tabIndex={0} aria-label="Format Header CSV">
          <code>name,nik,email,organization,ou,password,pfx_pass</code>
        </div>
        <div className="csv-rules-notes">
          <ul>
            <li><strong>NIK:</strong> Wajib tepat 16 digit angka unik.</li>
            <li><strong>Password Login:</strong> Minimal 8 karakter, minimal 1 huruf kapital (A-Z), dan minimal 1 simbol khusus.</li>
            <li><strong>Passphrase:</strong> Minimal 8 karakter untuk enkripsi berkas sertifikat PKCS#12.</li>
          </ul>
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
              <h3 className="results-summary-title">Ringkasan Hasil Provisioning Massal</h3>
              <p className="results-summary-desc">
                Berikut hasil eksekusi batch pembuatan pengguna dan penerbitan sertifikat digital X.509.
              </p>
            </div>

            <div className="results-stat-badges-row">
              <div className="result-badge-item badge-total">
                <span className="badge-item-label">Total Data</span>
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
              <h4 className="results-table-title">Rincian Hasil per Baris</h4>
            </div>

            <div className="bulk-table-responsive-wrapper" tabIndex={0} aria-label="Tabel Hasil Batch">
              <table className="bulk-preview-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '80px' }}>Baris</th>
                    <th scope="col">NIK</th>
                    <th scope="col" style={{ width: '120px' }}>Status</th>
                    <th scope="col">Keterangan / Informasi Kegagalan</th>
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
                          label={item.status === 'SUCCESS' ? 'BERHASIL' : 'GAGAL'}
                        />
                      </td>
                      <td className="result-error-cell">
                        {item.status === 'SUCCESS' ? (
                          <span className="text-success flex-align-center">
                            <IconCheckCircle size={15} aria-hidden="true" />
                            <span>Pengguna dan sertifikat berhasil diterbitkan</span>
                          </span>
                        ) : (
                          <span className="text-danger flex-align-center">
                            <IconXCircle size={15} aria-hidden="true" />
                            <span>{item.error || 'Provisioning gagal'}</span>
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
                <span>Unggah Berkas CSV Baru</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={onNavigateUsers}
              >
                <span>Buka Daftar Pengguna</span>
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
              <h3 className="file-upload-title">Unggah Berkas CSV</h3>
              <p className="file-upload-subtitle">
                Pilih berkas CSV (.csv) yang berisi daftar data pengguna untuk diproses.
              </p>
            </div>

            <div className="file-input-wrapper">
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
              <label htmlFor="csv-file-upload" className="btn btn-ghost btn-choose-file">
                <span>Pilih Berkas CSV...</span>
              </label>

              {selectedFile && (
                <div className="selected-file-badge">
                  <span className="file-name-text font-mono">{selectedFile.name}</span>
                  <span className="file-size-text">({Math.ceil(selectedFile.size / 1024)} KB)</span>
                </div>
              )}
            </div>
          </div>

          {/* Validation and Preview Card */}
          {validationResult && (
            <div className="bulk-preview-card" role="region" aria-label="Pratinjau Data CSV">
              <div className="preview-card-header">
                <div className="preview-summary-left">
                  <h4 className="preview-card-title">Pratinjau Data Pengguna</h4>
                  <p className="preview-card-subtitle">
                    Periksa keabsahan data sebelum melakukan provisioning massal. Password tidak ditampilkan pada pratinjau.
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
                      Tidak Valid: <strong>{validationResult.invalidCount}</strong>
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
                      <th scope="col">Organisasi / OU</th>
                      <th scope="col" style={{ width: '120px' }}>Validasi</th>
                      <th scope="col">Catatan Error</th>
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
                            label={row.isValid ? 'VALID' : 'INVALID'}
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
                  Reset / Pilih Berkas Lain
                </button>

                <div className="preview-submit-group">
                  {validationResult.invalidCount > 0 && (
                    <p className="invalid-warning-hint" role="note">
                      Terdapat baris data yang belum valid. Harap perbaiki berkas CSV dan unggah ulang sebelum memproses.
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-process-bulk"
                    onClick={handleSubmitBulk}
                    disabled={isSubmitting || validationResult.invalidCount > 0}
                  >
                    {isSubmitting
                      ? 'Memproses Batch Provisioning...'
                      : `Proses Batch (${validationResult.validCount} Pengguna)`}
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
