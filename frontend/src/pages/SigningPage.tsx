import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import {
  IconSignature,
  IconEye,
  IconEyeOff,
  IconClose,
  IconCheckCircle,
  IconAlertTriangle,
  IconRefresh
} from '../components/icons/Icons';
import { getAuthUser } from '../services/api';
import { signPdfDocument } from '../services/signatures';

interface SigningPageProps {
  onNavigate?: (path: string) => void;
}

export function SigningPage({ onNavigate: _onNavigate }: SigningPageProps) {
  const authUser = getAuthUser();
  const isAdmin = authUser?.role === 'ADMIN';

  // Form states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [useStamp, setUseStamp] = useState(true);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [llx, setLlx] = useState<number>(218);
  const [lly, setLly] = useState<number>(393);
  const [urx, setUrx] = useState<number>(258);
  const [ury, setUry] = useState<number>(433);
  const [adminTargetNik, setAdminTargetNik] = useState<string>('');

  // Modal & Passphrase states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success states
  const [signedResult, setSignedResult] = useState<{ blobUrl: string; filename: string } | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  const handlePdfChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setErrorMsg('Berkas yang dipilih harus berformat PDF (.pdf).');
        return;
      }
      setPdfFile(file);
      setErrorMsg(null);
      setSignedResult(null);
    }
  };

  const handleStampChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpg|jpeg)$/i)) {
        setErrorMsg('Berkas stempel harus berupa gambar PNG atau JPEG.');
        return;
      }
      setStampFile(file);
      setErrorMsg(null);
    }
  };

  const openPassphraseModal = (e: FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      setErrorMsg('Silakan pilih berkas PDF yang ingin ditandatangani terlebih dahulu.');
      return;
    }
    setErrorMsg(null);
    setPassphrase('');
    setIsModalOpen(true);
  };

  const handleExecuteSign = async () => {
    if (!pdfFile) return;
    if (!passphrase.trim()) {
      setErrorMsg('Passphrase sertifikat (.p12) wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await signPdfDocument({
        pdf: pdfFile,
        stamp: useStamp ? stampFile : null,
        page: pageNumber,
        llx: useStamp ? llx : undefined,
        lly: useStamp ? lly : undefined,
        urx: useStamp ? urx : undefined,
        ury: useStamp ? ury : undefined,
        passphrase: passphrase.trim(),
        nik: isAdmin && adminTargetNik.trim() ? adminTargetNik.trim() : undefined,
      });

      // Buat URL unduhan lokal
      const blobUrl = window.URL.createObjectURL(result.blob);
      setSignedResult({ blobUrl, filename: result.filename });
      setIsModalOpen(false);
      setPassphrase('');

      // Otomatis picu download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menandatangani dokumen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setPdfFile(null);
    setStampFile(null);
    setSignedResult(null);
    setErrorMsg(null);
    setPassphrase('');
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    if (stampInputRef.current) stampInputRef.current.value = '';
  };

  return (
    <div className="signing-page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title-group">
          <h1 className="page-title">Penandatanganan Dokumen</h1>
        </div>
        <p className="page-subtitle">
          Sematkan tanda tangan digital terverifikasi dan stempel visual pada dokumen PDF Anda.
        </p>
      </div>

      {/* Success Notification Banner */}
      {signedResult && (
        <div className="alert alert-success" role="alert" style={{ marginBottom: '1.5rem' }}>
          <IconCheckCircle size={20} className="alert-icon" />
          <div className="alert-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <strong>Dokumen Berhasil Ditandatangani!</strong>
              <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Berkas <code>{signedResult.filename}</code> telah selesai diproses dan diunduh.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a
                href={signedResult.blobUrl}
                download={signedResult.filename}
                className="btn btn-primary btn-sm"
              >
                Unduh Lagi
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleReset}
              >
                Tandatangani Dokumen Lain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMsg && !isModalOpen && (
        <div className="alert alert-danger" role="alert" style={{ marginBottom: '1.5rem' }}>
          <IconAlertTriangle size={20} className="alert-icon" />
          <div className="alert-content">
            <strong>Terjadi Kesalahan:</strong> {errorMsg}
          </div>
        </div>
      )}

      {/* Main Form Card */}
      <div className="card signing-card">
        <form onSubmit={openPassphraseModal}>
          {/* Section 1: Upload PDF */}
          <div className="form-section" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text)' }}>
              1. Berkas Dokumen PDF
            </h2>
            <div
              className={`signing-dropzone-area ${pdfFile ? 'has-file' : ''}`}
              onClick={() => pdfInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pdfInputRef.current?.click();
                }
              }}
              aria-label="Area unggah berkas PDF"
            >
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfChange}
                style={{ display: 'none' }}
              />
              <IconSignature size={36} style={{ margin: '0 auto 10px', color: pdfFile ? 'var(--gold-line)' : 'var(--text-2)' }} />
              {pdfFile ? (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--accent-text)', fontSize: '14px' }}>{pdfFile.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>
                    Ukuran: {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    style={{ marginTop: '12px' }}
                  >
                    Ganti Berkas
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>Klik untuk memilih berkas PDF</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>
                    Hanya menerima format PDF (maks. 20 MB)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Penempatan Halaman & Stempel */}
          <div className="form-section" style={{ marginBottom: '24px', borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', color: 'var(--text)' }}>
              2. Pengaturan Posisi & Stempel Visual
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label className="input-label" htmlFor="page-number-input">
                  Nomor Halaman
                </label>
                <input
                  id="page-number-input"
                  type="number"
                  min="1"
                  className="form-control"
                  value={pageNumber}
                  onChange={(e) => setPageNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                />
                <span className="form-hint" style={{ marginTop: '4px', display: 'block' }}>Halaman target tempat tanda tangan dibubuhkan.</span>
              </div>

              {isAdmin && (
                <div>
                  <label className="input-label" htmlFor="admin-nik-input">
                    NIK Pemilik Sertifikat (Opsional)
                  </label>
                  <input
                    id="admin-nik-input"
                    type="text"
                    maxLength={16}
                    className="form-control"
                    placeholder="Kosongkan untuk NIK sendiri"
                    value={adminTargetNik}
                    onChange={(e) => setAdminTargetNik(e.target.value)}
                  />
                  <span className="form-hint" style={{ marginTop: '4px', display: 'block' }}>Khusus Admin jika menandatangani atas nama pengguna lain.</span>
                </div>
              )}
            </div>

            {/* Toggle Visual Stamp */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '13px', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={useStamp}
                  onChange={(e) => setUseStamp(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                />
                Bubuhkan Stempel Visual / Tanda Tangan Gambar (PNG/JPG)
              </label>
            </div>

            {useStamp && (
              <div className="signing-coords-box">
                <div style={{ marginBottom: '12px' }}>
                  <label className="input-label" htmlFor="stamp-file-input">
                    Berkas Stempel / Tanda Tangan (PNG / JPG)
                  </label>
                  <input
                    id="stamp-file-input"
                    ref={stampInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="form-control"
                    onChange={handleStampChange}
                    style={{ marginTop: '4px' }}
                  />
                  {stampFile && (
                    <div style={{ fontSize: '12px', color: 'var(--ok)', marginTop: '4px', fontWeight: 500 }}>
                      Stempel terpilih: <strong>{stampFile.name}</strong>
                    </div>
                  )}
                </div>

                {/* Section 7: Grid Layout dengan Pratinjau A4 di Sebelah Kolom Posisi */}
                <div className="signing-layout-container">
                  {/* Kolom Koordinat Dikelompokkan */}
                  <div>
                    {/* Kelompok 1: Sudut kiri bawah stempel */}
                    <div style={{ marginBottom: '14px' }}>
                      <div className="signing-coords-group-title">
                        Sudut kiri bawah stempel
                      </div>
                      <div className="signing-coords-row">
                        <div>
                          <label className="sub" style={{ display: 'block', marginBottom: '3px' }}>Posisi X (Poin)</label>
                          <input
                            type="number"
                            className="form-control"
                            value={llx}
                            min={0}
                            max={595}
                            onChange={(e) => setLlx(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="sub" style={{ display: 'block', marginBottom: '3px' }}>Posisi Y (Poin)</label>
                          <input
                            type="number"
                            className="form-control"
                            value={lly}
                            min={0}
                            max={842}
                            onChange={(e) => setLly(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Kelompok 2: Sudut kanan atas stempel */}
                    <div style={{ marginBottom: '12px' }}>
                      <div className="signing-coords-group-title">
                        Sudut kanan atas stempel
                      </div>
                      <div className="signing-coords-row">
                        <div>
                          <label className="sub" style={{ display: 'block', marginBottom: '3px' }}>Posisi X (Poin)</label>
                          <input
                            type="number"
                            className="form-control"
                            value={urx}
                            min={0}
                            max={595}
                            onChange={(e) => setUrx(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="sub" style={{ display: 'block', marginBottom: '3px' }}>Posisi Y (Poin)</label>
                          <input
                            type="number"
                            className="form-control"
                            value={ury}
                            min={0}
                            max={842}
                            onChange={(e) => setUry(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-hint" style={{ lineHeight: 1.4 }}>
                      Sistem koordinat PDF Points (A4: 595 x 842 pt). Klik atau geser kotak stempel pada pratinjau di samping untuk memindahkannya.
                    </div>
                  </div>

                  {/* Pratinjau Halaman A4 Interaktif (210px x 297px) */}
                  <div className="signing-a4-preview-wrapper">
                    <div
                      className="signing-a4-paper"
                      title="Klik di kertas untuk memindahkan stempel"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        const stampW = Math.max(10, urx - llx);
                        const stampH = Math.max(10, ury - lly);
                        const normX = Math.max(0, Math.min(1, clickX / rect.width));
                        const normY = Math.max(0, Math.min(1, 1 - clickY / rect.height));
                        const targetX = Math.round(normX * 595 - stampW / 2);
                        const targetY = Math.round(normY * 842 - stampH / 2);
                        const clampedLlx = Math.max(0, Math.min(595 - stampW, targetX));
                        const clampedLly = Math.max(0, Math.min(842 - stampH, targetY));
                        setLlx(clampedLlx);
                        setLly(clampedLly);
                        setUrx(clampedLlx + stampW);
                        setUry(clampedLly + stampH);
                      }}
                    >
                      <div className="signing-a4-paper-grid" />
                      <div
                        className="signing-a4-stamp-box"
                        style={{
                          left: `${Math.max(0, Math.min(100, (llx / 595) * 100))}%`,
                          bottom: `${Math.max(0, Math.min(100, (lly / 842) * 100))}%`,
                          width: `${Math.max(5, Math.min(100, ((urx - llx) / 595) * 100))}%`,
                          height: `${Math.max(4, Math.min(100, ((ury - lly) / 842) * 100))}%`,
                        }}
                      >
                        Stempel
                      </div>
                    </div>
                    <span className="signing-a4-hint">
                      Pratinjau A4 (595 × 842 pt)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleReset}
              disabled={!pdfFile}
            >
              Reset
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!pdfFile || (useStamp && (llx < 0 || lly < 0 || urx <= llx || ury <= lly))}
            >
              Lanjutkan ke Penandatanganan
            </button>
          </div>
        </form>
      </div>

      {/* Modal Input Passphrase */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '480px', margin: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                Verifikasi Passphrase Sertifikat
              </h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                disabled={isSubmitting}
                aria-label="Tutup"
              >
                <IconClose size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              Masukkan passphrase sertifikat digital (.p12) Anda untuk mendekripsi private key dan menandatangani dokumen <strong>{pdfFile?.name}</strong>.
            </p>

            {errorMsg && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                <IconAlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="p12-passphrase-input">
                Passphrase Sertifikat (.p12)
              </label>
              <div className="input-password-wrapper" style={{ position: 'relative' }}>
                <input
                  id="p12-passphrase-input"
                  type={showPassphrase ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Masukkan passphrase sertifikat..."
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  disabled={isSubmitting}
                  aria-label={showPassphrase ? 'Sembunyikan passphrase' : 'Tampilkan passphrase'}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.7,
                  }}
                >
                  {showPassphrase ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
              <span className="form-hint">
                Passphrase hanya diproses di memori saat penandatanganan dan tidak pernah disimpan.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteSign}
                disabled={isSubmitting || !passphrase.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isSubmitting ? (
                  <>
                    <IconRefresh size={16} className="spinner" />
                    <span>Menandatangani...</span>
                  </>
                ) : (
                  <>
                    <IconSignature size={16} />
                    <span>Tanda Tangani & Unduh</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
