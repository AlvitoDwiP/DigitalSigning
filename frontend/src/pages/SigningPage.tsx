import { useState } from 'react';
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconDownload,
  IconRefresh,
} from '../components/icons/Icons';
import { getAuthUser } from '../services/api';
import {
  SignatureMode,
  SignatureVisualType,
  SignaturePlacement,
  FooterPositionPreset,
  getDefaultPlacement,
  getPresetPlacement,
  placementToCoordinates,
  countPdfPages,
  generateQrStampBlob,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
} from '../utils/pdfHelper';
import { signPdfDocument } from '../services/signatures';
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

  // 2. State TTE: Mode, Target Page (1 Halaman Saja), & Penempatan Kotak
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('visible');
  const [visualType, setVisualType] = useState<SignatureVisualType>('qr_text');
  const [targetPage, setTargetPage] = useState<number>(1);
  const [placement, setPlacement] = useState<SignaturePlacement>(() => getDefaultPlacement(1));

  // 3. State Tampilan & Aset Gambar
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

  // 6. State Tab Navigasi Mobile ('form' | 'preview')
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');

  // Handler Pemilihan File PDF (Membuka langsung di Halaman 1)
  const handleSelectPdf = async (file: File) => {
    setPdfFile(file);
    setSignedResult(null);
    setErrorMsg(null);
    setIsLoadingPages(true);

    try {
      const count = await countPdfPages(file);
      setPageCount(count);
      setCurrentPage(1); // User requirement: membuka Halaman 1
      setTargetPage(1);
      setPlacement(getDefaultPlacement(1));
    } catch {
      setPageCount(1);
      setCurrentPage(1);
      setTargetPage(1);
      setPlacement(getDefaultPlacement(1));
    } finally {
      setIsLoadingPages(false);
    }
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setPageCount(1);
    setCurrentPage(1);
    setTargetPage(1);
    setSignedResult(null);
    setErrorMsg(null);
  };

  const handlePresetSelect = (preset: FooterPositionPreset) => {
    setPlacement((prev) =>
      getPresetPlacement(preset, prev.page, A4_WIDTH_PT, A4_HEIGHT_PT, prev.width, prev.height)
    );
  };

  const handleTargetPageChange = (page: number) => {
    setTargetPage(page);
    setPlacement((prev) => ({ ...prev, page }));
    if (page >= 1 && page <= pageCount) {
      setCurrentPage(page);
    }
  };

  const isFormValid = Boolean(pdfFile) && targetPage >= 1 && targetPage <= pageCount;

  // Buka modal konfirmasi passphrase
  const handleOpenConfirm = () => {
    if (!isFormValid) {
      if (!pdfFile) {
        setErrorMsg('Pilih dokumen PDF terlebih dahulu.');
      } else if (targetPage < 1 || targetPage > pageCount) {
        setErrorMsg(`Masukkan nomor halaman target yang valid (1 – ${pageCount}).`);
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

    // Format nama berkas keluaran: {nama file}_sign.pdf
    const origName = pdfFile.name;
    const stem = origName.replace(/\.[^/.]+$/, '');
    const downloadFilename = `${stem}_sign.pdf`;

    try {
      let stampToSend: File | Blob | null = null;
      if (signatureMode === 'visible') {
        if (visualType === 'image' && stampFile) {
          stampToSend = stampFile;
        } else if (visualType === 'qr_text') {
          const currentDateStr = new Date().toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const currentTimeStr = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          });
          stampToSend = await generateQrStampBlob({
            signerName,
            organization,
            dateStr: `${currentDateStr} ${currentTimeStr} WIB`,
            width: placement.width,
            height: placement.height,
          });
        }
      }

      const coords = placementToCoordinates(placement);

      const result = await signPdfDocument({
        pdf: pdfFile,
        stamp: stampToSend,
        page: placement.page,
        llx: signatureMode === 'visible' ? coords.llx : undefined,
        lly: signatureMode === 'visible' ? coords.lly : undefined,
        urx: signatureMode === 'visible' ? coords.urx : undefined,
        ury: signatureMode === 'visible' ? coords.ury : undefined,
        visible: signatureMode === 'visible',
        passphrase: _passphrase,
      });

      const blobUrl = window.URL.createObjectURL(result.blob);
      setSignedResult({
        blobUrl,
        filename: downloadFilename,
      });
      setIsModalOpen(false);

      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = downloadFilename;
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
    setTargetPage(1);
    setSignatureMode('visible');
    setVisualType('qr_text');
    setPlacement(getDefaultPlacement(1));
    setSignedResult(null);
    setErrorMsg(null);
    setIsModalOpen(false);
  };

  // Ringkasan target halaman untuk modal konfirmasi
  const targetPageSummary = `Halaman ${placement.page} dari ${pageCount}`;
  const signatureModeLabel =
    signatureMode === 'visible' ? 'Terlihat (Visible Signature)' : 'Tak Terlihat (Invisible Signature)';
  const visualFormatLabel =
    signatureMode === 'visible'
      ? visualType === 'qr_text'
        ? 'QR Code'
        : stampFile
          ? `Gambar Paraf (${stampFile.name})`
          : 'Gambar Paraf'
      : undefined;
  const dimensionsLabel =
    signatureMode === 'visible' ? `${placement.width} × ${placement.height} pt` : undefined;

  return (
    <div className="tte-page-wrapper">
      {/* Header Halaman */}
      <div className="page-header-row tte-page-header">
        <div className="page-header">
          <h1 className="page-title">TANDA TANGANI DOKUMEN</h1>
          <p className="page-subtitle">
            Tambahkan tanda tangan elektronik (TTE) pada satu halaman dokumen.
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

      {/* Mobile Stepper / Tab Switcher (Hanya tampil di tablet & mobile < 1025px) */}
      <div className="tte-mobile-stepper" role="tablist" aria-label="Langkah Penandatanganan Mobile">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'form'}
          className={`tte-mobile-stepper-btn ${mobileTab === 'form' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('form')}
        >
          <span className="tte-stepper-badge">1</span>
          <span className="tte-stepper-label">Formulir TTE</span>
          {pdfFile && <span className="tte-stepper-check" aria-hidden="true">✓</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'preview'}
          className={`tte-mobile-stepper-btn ${mobileTab === 'preview' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('preview')}
          disabled={!pdfFile}
          title={!pdfFile ? 'Unggah berkas PDF terlebih dahulu untuk melihat pratinjau' : undefined}
        >
          <span className="tte-stepper-badge">2</span>
          <span className="tte-stepper-label">Pratinjau Lembar</span>
          {pdfFile && (
            <span className="tte-stepper-page-badge">
              Hal {currentPage}/{pageCount}
            </span>
          )}
        </button>
      </div>

      {/* Grid Utama: Panel Konfigurasi Kiri & Pratinjau Dokumen Kanan */}
      <div className={`tte-main-grid tte-mobile-view-${mobileTab}`}>
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

          {/* Langkah 2, 3, 4: Konfigurasi TTE & Aksi (hanya tampil jika PDF terpilih) */}
          {pdfFile && (
            <FooterConfigPanel
              pdfFile={pdfFile}
              pageCount={pageCount}
              signatureMode={signatureMode}
              onChangeSignatureMode={setSignatureMode}
              targetPage={targetPage}
              onChangeTargetPage={handleTargetPageChange}
              visualType={visualType}
              onChangeVisualType={setVisualType}
              placement={placement}
              onChangePlacement={setPlacement}
              onPresetSelect={handlePresetSelect}
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
              onGoToPreview={() => setMobileTab('preview')}
            />
          )}
        </div>

        {/* Kolom Kanan: Pratinjau Dokumen PDF Real & Kotak TTE Draggable/Resizable */}
        <div className="tte-right-col">
          <PdfInteractivePreview
            pdfFile={pdfFile}
            pageCount={pageCount}
            currentPage={currentPage}
            onChangeCurrentPage={setCurrentPage}
            signatureMode={signatureMode}
            visualType={visualType}
            placement={placement}
            onChangePlacement={setPlacement}
            displayOptions={displayOptions}
            stampFile={stampFile}
            signerName={signerName}
            organization={organization}
            onSwitchToForm={() => setMobileTab('form')}
            onOpenConfirmSign={handleOpenConfirm}
            isFormValid={isFormValid}
            isVisibleTab={mobileTab === 'preview'}
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
        signatureModeLabel={signatureModeLabel}
        visualFormatLabel={visualFormatLabel}
        dimensionsLabel={dimensionsLabel}
        isSubmitting={isSubmitting}
        errorMsg={errorMsg}
      />
    </div>
  );
}

