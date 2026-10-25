import { useState, useRef, MouseEvent, useMemo } from 'react';
import {
  IconFileText,
  IconChevronLeft,
  IconChevronRight,
  IconAlertTriangle,
  IconShield,
  IconEye
} from '../icons/Icons';
import {
  FooterCoordinates,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  TargetPageOption,
} from '../../utils/pdfHelper';
import { FooterDisplayOptions } from './FooterConfigPanel';

interface PdfInteractivePreviewProps {
  pdfFile: File | null;
  pageCount: number;
  currentPage: number;
  onChangeCurrentPage: (page: number) => void;
  targetPageOption: TargetPageOption;
  specificPage: number;
  coords: FooterCoordinates;
  onChangeCoords: (coords: FooterCoordinates) => void;
  displayOptions: FooterDisplayOptions;
  stampFile: File | null;
  signerName: string;
  organization: string;
}

export function PdfInteractivePreview({
  pdfFile,
  pageCount,
  currentPage,
  onChangeCurrentPage,
  targetPageOption,
  specificPage,
  coords,
  onChangeCoords,
  displayOptions,
  stampFile,
  signerName,
  organization,
}: PdfInteractivePreviewProps) {
  const [previewTab, setPreviewTab] = useState<'sheet' | 'native'>('sheet');
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startLlx: number; startLly: number } | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Buat URL Blob untuk pratinjau PDF asli
  const pdfBlobUrl = useMemo(() => {
    if (!pdfFile) return null;
    return URL.createObjectURL(pdfFile);
  }, [pdfFile]);

  // Apakah halaman saat ini adalah halaman yang dibubuhi footer?
  const isFooterOnCurrentPage =
    targetPageOption === 'all' ||
    (targetPageOption === 'last' && currentPage === pageCount) ||
    (targetPageOption === 'specific' && currentPage === specificPage);

  // Validasi posisi di luar batas A4
  const isOutOfBounds =
    coords.llx < 0 ||
    coords.lly < 0 ||
    coords.urx > A4_WIDTH_PT ||
    coords.ury > A4_HEIGHT_PT;

  // Interaksi Drag-to-Move pada kotak footer di lembar pratinjau
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startLlx: coords.llx,
      startLly: coords.lly,
    };

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      if (!dragStartRef.current || !paperRef.current) return;
      const rect = paperRef.current.getBoundingClientRect();
      const scaleX = A4_WIDTH_PT / rect.width;
      const scaleY = A4_HEIGHT_PT / rect.height;

      const deltaX = (moveEvent.clientX - dragStartRef.current.mouseX) * scaleX;
      // Di PDF coordinate system: Y=0 adalah BAWAH. Di browser: Y=0 adalah ATAS.
      const deltaY = -(moveEvent.clientY - dragStartRef.current.mouseY) * scaleY;

      const width = coords.urx - coords.llx;
      const height = coords.ury - coords.lly;

      let newLlx = Math.round(dragStartRef.current.startLlx + deltaX);
      let newLly = Math.round(dragStartRef.current.startLly + deltaY);

      // Batasi agar tidak meluncur jauh ke luar lembar
      newLlx = Math.max(-20, Math.min(A4_WIDTH_PT - width + 20, newLlx));
      newLly = Math.max(-20, Math.min(A4_HEIGHT_PT - height + 20, newLly));

      onChangeCoords({
        llx: newLlx,
        lly: newLly,
        urx: newLlx + width,
        ury: newLly + height,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Konversi koordinat PDF points ke persentase CSS untuk penempatan presisi
  // PDF: llx, lly (dari kiri bawah), urx, ury.
  // CSS: left = (llx / 595.28) * 100%, top = ((841.89 - ury) / 841.89) * 100%
  const boxWidthPct = ((coords.urx - coords.llx) / A4_WIDTH_PT) * 100;
  const boxHeightPct = ((coords.ury - coords.lly) / A4_HEIGHT_PT) * 100;
  const boxLeftPct = (coords.llx / A4_WIDTH_PT) * 100;
  const boxTopPct = ((A4_HEIGHT_PT - coords.ury) / A4_HEIGHT_PT) * 100;

  const stampUrl = useMemo(() => {
    if (!stampFile) return null;
    return URL.createObjectURL(stampFile);
  }, [stampFile]);

  // Waktu format Indonesia
  const currentDateStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const currentTimeStr = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="tte-preview-panel">
      {/* Header Panel Pratinjau */}
      <div className="tte-preview-header">
        <div className="tte-preview-tab-group" role="tablist" aria-label="Mode Pratinjau">
          <button
            type="button"
            role="tab"
            aria-selected={previewTab === 'sheet'}
            className={`tte-preview-tab-btn ${previewTab === 'sheet' ? 'is-active' : ''}`}
            onClick={() => setPreviewTab('sheet')}
          >
            Posisi Footer TTE
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={previewTab === 'native'}
            className={`tte-preview-tab-btn ${previewTab === 'native' ? 'is-active' : ''}`}
            onClick={() => setPreviewTab('native')}
            disabled={!pdfFile}
            title={!pdfFile ? 'Pilih PDF terlebih dahulu' : 'Buka dokumen PDF asli'}
          >
            <IconEye size={14} aria-hidden="true" />
            <span>Lihat Isi PDF</span>
          </button>
        </div>

        {/* Kontrol Navigasi Halaman */}
        {pdfFile && pageCount > 1 && (
          <div className="tte-preview-pagination">
            <button
              type="button"
              className="btn btn-ghost btn-sm tte-page-nav-btn"
              onClick={() => onChangeCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              aria-label="Halaman sebelumnya"
              title="Halaman sebelumnya"
            >
              <IconChevronLeft size={16} />
            </button>
            <span className="tte-page-counter">
              Hal. <strong>{currentPage}</strong> dari {pageCount}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm tte-page-nav-btn"
              onClick={() => onChangeCurrentPage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage >= pageCount}
              aria-label="Halaman berikutnya"
              title="Halaman berikutnya"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Body Pratinjau */}
      <div className="tte-preview-body">
        {!pdfFile ? (
          /* Empty State */
          <div className="tte-empty-preview-card" role="status">
            <div className="tte-empty-icon-wrap" aria-hidden="true">
              <IconFileText size={48} />
            </div>
            <h3 className="tte-empty-title">Pratinjau dokumen akan muncul setelah PDF dipilih.</h3>
            <p className="tte-empty-desc">
              Unggah dokumen PDF di panel sebelah kiri untuk mengatur posisi stempel dan memverifikasi tampilan footer tanda tangan digital secara langsung.
            </p>
            <div className="tte-empty-steps-list">
              <div className="tte-empty-step-item">
                <span className="tte-empty-step-num">1</span>
                <span>Pilih berkas dokumen PDF</span>
              </div>
              <div className="tte-empty-step-item">
                <span className="tte-empty-step-num">2</span>
                <span>Tentukan penempatan footer TTE</span>
              </div>
              <div className="tte-empty-step-item">
                <span className="tte-empty-step-num">3</span>
                <span>Periksa pratinjau & konfirmasi tanda tangan</span>
              </div>
            </div>
          </div>
        ) : previewTab === 'native' && pdfBlobUrl ? (
          /* Native PDF Viewer via Embed/Iframe */
          <div className="tte-native-pdf-wrapper">
            <iframe
              src={`${pdfBlobUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
              title="Pratinjau Berkas Dokumen PDF Asli"
              className="tte-native-iframe"
            />
          </div>
        ) : (
          /* Lembar Interaktif A4 dengan Footer TTE */
          <div className="tte-sheet-scroll-container">
            {/* Status Penempatan Footer di Halaman Ini */}
            <div className="tte-sheet-status-bar">
              <span className={`tte-status-pill ${isFooterOnCurrentPage ? 'is-active-target' : 'is-inactive-target'}`}>
                {isFooterOnCurrentPage ? (
                  <>
                    <span className="tte-status-dot" aria-hidden="true" />
                    <span>Footer TTE disematkan di halaman ini ({currentPage})</span>
                  </>
                ) : (
                  <span>
                    Footer TTE tidak aktif di halaman ini ({targetPageOption === 'last' ? `Hanya di hal. ${pageCount}` : `Di hal. ${specificPage}`})
                  </span>
                )}
              </span>

              {isOutOfBounds && (
                <span className="tte-warning-pill">
                  <IconAlertTriangle size={13} aria-hidden="true" />
                  <span>Posisi di luar batas A4</span>
                </span>
              )}
            </div>

            {/* Lembar Dokumen A4 */}
            <div
              ref={paperRef}
              className="tte-a4-sheet"
              aria-label={`Lembar Dokumen A4 Halaman ${currentPage}`}
            >
              {/* Header Lembar Dummy Representatif */}
              <div className="tte-sheet-mock-header">
                <div className="tte-sheet-mock-line-logo" />
                <div className="tte-sheet-mock-lines">
                  <div className="tte-sheet-line line-long" />
                  <div className="tte-sheet-line line-med" />
                </div>
              </div>

              {/* Watermark Garis Teks Dokumen */}
              <div className="tte-sheet-mock-content">
                <div className="tte-sheet-line line-heading" />
                <div className="tte-sheet-line line-full" />
                <div className="tte-sheet-line line-full" />
                <div className="tte-sheet-line line-full" />
                <div className="tte-sheet-line line-34" />

                <div className="tte-sheet-line line-spacer" />
                <div className="tte-sheet-line line-full" />
                <div className="tte-sheet-line line-full" />
                <div className="tte-sheet-line line-half" />
              </div>

              {/* Nomor Halaman Watermark */}
              <div className="tte-sheet-page-watermark">
                Halaman {currentPage}
              </div>

              {/* Kotak Footer TTE Interaktif */}
              {isFooterOnCurrentPage && (
                <div
                  className={`tte-footer-box ${isDragging ? 'is-dragging' : ''} ${isOutOfBounds ? 'is-out' : ''}`}
                  style={{
                    left: `${boxLeftPct}%`,
                    top: `${boxTopPct}%`,
                    width: `${boxWidthPct}%`,
                    height: `${boxHeightPct}%`,
                  }}
                  onMouseDown={handleMouseDown}
                  role="region"
                  aria-label="Kotak Footer TTE. Klik dan seret untuk memindahkan posisi."
                  title="Klik dan seret (drag) untuk memindahkan posisi footer"
                >
                  <div className="tte-footer-inner">
                    {/* QR Code Verifikasi */}
                    {displayOptions.showQr && (
                      <div className="tte-footer-qr" aria-hidden="true">
                        <svg viewBox="0 0 32 32" width="100%" height="100%" fill="currentColor">
                          <rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                          <rect x="5" y="5" width="4" height="4" fill="currentColor" />
                          <rect x="20" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                          <rect x="23" y="5" width="4" height="4" fill="currentColor" />
                          <rect x="2" y="20" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                          <rect x="5" y="23" width="4" height="4" fill="currentColor" />
                          <rect x="15" y="15" width="3" height="3" fill="currentColor" />
                          <rect x="22" y="18" width="5" height="3" fill="currentColor" />
                          <rect x="18" y="24" width="4" height="4" fill="currentColor" />
                        </svg>
                      </div>
                    )}

                    {/* Gambar Tanda Tangan jika ada */}
                    {stampUrl && (
                      <div className="tte-footer-stamp-thumb" aria-hidden="true">
                        <img src={stampUrl} alt="Stempel tanda tangan" />
                      </div>
                    )}

                    {/* Informasi Teks Footer */}
                    <div className="tte-footer-texts">
                      <span className="tte-footer-header-tag">
                        <IconShield size={10} aria-hidden="true" />
                        <span>TTE TERSERTIFIKASI</span>
                      </span>

                      {displayOptions.showSignerName && (
                        <strong className="tte-footer-signer-name">{signerName}</strong>
                      )}

                      {displayOptions.showOrganization && (
                        <span className="tte-footer-org">{organization}</span>
                      )}

                      {displayOptions.showTimestamp && (
                        <span className="tte-footer-time">{currentDateStr} {currentTimeStr} WIB</span>
                      )}
                    </div>
                  </div>

                  {/* Drag Handle Indicator */}
                  <div className="tte-drag-handle" title="Geser posisi">
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </div>

            {/* Hint Geser */}
            {isFooterOnCurrentPage && (
              <p className="tte-drag-hint">
                💡 <em>Tips:</em> Anda dapat menggeser langsung kotak footer di atas lembar pratinjau untuk menentukan posisi yang diinginkan.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
