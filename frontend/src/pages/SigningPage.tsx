import { useState } from 'react';
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconDownload,
  IconRefresh,
} from '../components/icons/Icons';
import { getAuthUser } from '../services/api';
import {
  FooterPositionPreset,
  TargetPageOption,
  FooterCoordinates,
  getPresetCoordinates,
  countPdfPages,
} from '../utils/pdfHelper';
import { PdfDropzone } from '../components/signing/PdfDropzone';
import {
  FooterConfigPanel,
  FooterDisplayOptions,
} from '../components/signing/FooterConfigPanel';
import { PdfInteractivePreview } from '../components/signing/PdfInteractivePreview';
import { PassphraseConfirmDialog } from '../components/signing/PassphraseConfirmDialog';

interface SigningPageProps {
  onNavigate?: (path: string) => void;
  viewMode?: 'admin' | 'user';
}

export function SigningPage({ onNavigate: _onNavigate, viewMode }: SigningPageProps) {
  const authUser = getAuthUser();
  const isAdmin = authUser?.role === 'ADMIN';
  const isUserView = viewMode === 'user';
  const signerName = authUser?.name || 'Pengguna Platform';
  const organization = 'Mahkamah Konstitusi RI';

  // 1. State Dokumen
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 2. State Pengaturan Halaman & Footer
  const [targetPageOption, setTargetPageOption] = useState<TargetPageOption>('last');
  const [specificPage, setSpecificPage] = useState<number>(1);
  const [positionPreset, setPositionPreset] = useState<FooterPositionPreset>('bottom-right');
  const [coords, setCoords] = useState<FooterCoordinates>(() => getPresetCoordinates('bottom-right'));

  // 3. State Tampilan Footer & Aset Gambar
  const [displayOptions, setDisplayOptions] = useState<FooterDisplayOptions>({
    showQr: true,
    showSignerName: true,
    showOrganization: true,
    showTimestamp: true,
  });
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [adminTargetNik, setAdminTargetNik] = useState<string>('');

  // 4. Modal & Proses TTE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 5. State Hasil Penandatanganan
  const [signedResult, setSignedResult] = useState<{ blobUrl: string; filename: string } | null>(null);

  // Handler Pemilihan File PDF
  const handleSelectPdf = async (file: File) => {
    setPdfFile(file);
    setSignedResult(null);
    setErrorMsg(null);
    setIsLoadingPages(true);

    try {
      const count = await countPdfPages(file);
      setPageCount(count);
      setCurrentPage(count); // Buka langsung ke halaman terakhir (target umum footer)
      setSpecificPage(count);
    } catch {
      setPageCount(1);
      setCurrentPage(1);
      setSpecificPage(1);
    } finally {
      setIsLoadingPages(false);
    }
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setPageCount(1);
    setCurrentPage(1);
    setSignedResult(null);
    setErrorMsg(null);
  };

  const handlePositionPresetChange = (preset: FooterPositionPreset) => {
    setPositionPreset(preset);
    if (preset !== 'custom') {
      setCoords(getPresetCoordinates(preset));
    }
  };

  const handleCoordsChange = (newCoords: FooterCoordinates) => {
    setCoords(newCoords);
    setPositionPreset('custom');
  };

  // Validasi form sebelum konfirmasi
  const isSpecificPageValid =
    targetPageOption !== 'specific' || (specificPage >= 1 && specificPage <= pageCount);

  const isFormValid = Boolean(pdfFile) && isSpecificPageValid;

  // Buka modal konfirmasi passphrase
  const handleOpenConfirm = () => {
    if (!isFormValid) {
      if (!pdfFile) {
        setErrorMsg('Pilih dokumen PDF terlebih dahulu.');
      } else if (!isSpecificPageValid) {
        setErrorMsg('Nomor halaman melebihi jumlah halaman dokumen.');
      }
      return;
    }
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Eksekusi penandatanganan dokumen
  const handleConfirmSign = async (_passphrase: string) => {
    if (!pdfFile) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Simulasi proses penandatanganan di sisi frontend (Mock state bertanda jelas untuk development)
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const outputFilename = `[signed]_${pdfFile.name}`;
      const blobUrl = window.URL.createObjectURL(pdfFile);

      setSignedResult({
        blobUrl,
        filename: outputFilename,
      });

      setIsModalOpen(false);

      // Otomatis unduh berkas hasil simulasi
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = outputFilename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err: any) {
      setErrorMsg(err.message || 'Penandatanganan gagal. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setPdfFile(null);
    setStampFile(null);
    setPageCount(1);
    setCurrentPage(1);
    setSpecificPage(1);
    setPositionPreset('bottom-right');
    setCoords(getPresetCoordinates('bottom-right'));
    setSignedResult(null);
    setErrorMsg(null);
    setIsModalOpen(false);
  };

  // Ringkasan target halaman untuk modal konfirmasi
  const targetPageSummary =
    targetPageOption === 'all'
      ? `Semua Halaman (1 – ${pageCount})`
      : targetPageOption === 'last'
      ? `Halaman Terakhir (Hal. ${pageCount})`
      : `Halaman ${specificPage} dari ${pageCount}`;

  return (
    <div className="tte-page-wrapper">
      {/* Header Halaman Sesuai Spesifikasi */}
      <div className="page-header-row tte-page-header">
        <div className="page-header">
          <div className="tte-title-badge-group">
            <h1 className="page-title">Tanda Tangani Dokumen</h1>
            <span className="tte-mode-pill" title="Fitur antarmuka aktif untuk demonstrasi dan uji tata letak">
              Mode Pratinjau TTE
            </span>
          </div>
          <p className="page-subtitle">
            Tambahkan tanda tangan elektronik dan pratinjau footer verifikasi pada dokumen PDF.
          </p>
        </div>
      </div>

      {/* Banner Hasil Penandatanganan (State Success) */}
      {signedResult && (
        <div className="tte-success-banner" role="status" aria-live="polite">
          <div className="tte-success-banner-content">
            <div className="tte-success-icon-badge" aria-hidden="true">
              <IconCheckCircle size={22} />
            </div>
            <div className="tte-success-texts">
              <strong className="tte-success-title">Dokumen berhasil ditandatangani</strong>
              <p className="tte-success-subtitle">
                Berkas <code>{signedResult.filename}</code> telah selesai diproses dan siap digunakan.
              </p>
            </div>
          </div>
          <div className="tte-success-actions">
            <a
              href={signedResult.blobUrl}
              download={signedResult.filename}
              className="btn btn-primary btn-sm tte-download-btn"
            >
              <IconDownload size={16} aria-hidden="true" />
              <span>Unduh PDF</span>
            </a>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleReset}
            >
              <IconRefresh size={15} aria-hidden="true" />
              <span>Tandatangani Dokumen Lain</span>
            </button>
          </div>
        </div>
      )}

      {/* Banner Pesan Error Umum */}
      {errorMsg && !isModalOpen && (
        <div className="alert-danger" role="alert" style={{ marginBottom: '16px' }}>
          <IconAlertTriangle size={18} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid Utama: Panel Konfigurasi Kiri & Pratinjau Dokumen Kanan */}
      <div className="tte-main-grid">
        {/* Kolom Kiri: Form Langkah Bertahap */}
        <div className="tte-left-col">
          {/* Langkah 1: Pilih Dokumen PDF */}
          <PdfDropzone
            pdfFile={pdfFile}
            pageCount={pageCount}
            isLoadingPages={isLoadingPages}
            onSelectFile={handleSelectPdf}
            onRemoveFile={handleRemovePdf}
          />

          {/* Langkah 2 & 3: Konfigurasi Footer TTE & Aksi (hanya tampil jika PDF terpilih) */}
          {pdfFile && (
            <FooterConfigPanel
              pdfFile={pdfFile}
              pageCount={pageCount}
              targetPageOption={targetPageOption}
              onChangeTargetPageOption={(opt) => {
                setTargetPageOption(opt);
                if (opt === 'last') setCurrentPage(pageCount);
                if (opt === 'specific') setCurrentPage(specificPage);
              }}
              specificPage={specificPage}
              onChangeSpecificPage={(p) => {
                setSpecificPage(p);
                setCurrentPage(p);
              }}
              positionPreset={positionPreset}
              onChangePositionPreset={handlePositionPresetChange}
              coords={coords}
              onChangeCoords={handleCoordsChange}
              displayOptions={displayOptions}
              onChangeDisplayOptions={setDisplayOptions}
              stampFile={stampFile}
              onSelectStamp={setStampFile}
              onRemoveStamp={() => setStampFile(null)}
              signerName={signerName}
              organization={organization}
              adminTargetNik={adminTargetNik}
              onChangeAdminTargetNik={setAdminTargetNik}
              isAdmin={isAdmin}
              isUserView={isUserView}
              onSubmitSign={handleOpenConfirm}
              onReset={handleReset}
              isValid={isFormValid}
            />
          )}
        </div>

        {/* Kolom Kanan: Pratinjau Dokumen PDF & Footer Interaktif */}
        <div className="tte-right-col">
          <PdfInteractivePreview
            pdfFile={pdfFile}
            pageCount={pageCount}
            currentPage={currentPage}
            onChangeCurrentPage={setCurrentPage}
            targetPageOption={targetPageOption}
            specificPage={specificPage}
            coords={coords}
            onChangeCoords={handleCoordsChange}
            displayOptions={displayOptions}
            stampFile={stampFile}
            signerName={signerName}
            organization={organization}
          />
        </div>
      </div>

      {/* Modal Konfirmasi Passphrase */}
      <PassphraseConfirmDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmSign}
        documentName={pdfFile ? pdfFile.name : ''}
        targetPageSummary={targetPageSummary}
        signerName={signerName}
        isSubmitting={isSubmitting}
        errorMsg={errorMsg}
      />
    </div>
  );
}
