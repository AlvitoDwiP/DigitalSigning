import { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  IconFileText,
  IconChevronLeft,
  IconChevronRight,
  IconAlertTriangle,
  IconMove,
  IconEyeOff,
  IconCheckCircle,
} from '../icons/Icons';
import {
  SignatureMode,
  SignatureVisualType,
  SignaturePlacement,
  FooterCoordinates,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
} from '../../utils/pdfHelper';
import {
  DocumentFontInfo,
  normalizePdfFontFamily,
  extractDocumentFontInfo,
} from '../../utils/pdfTypography';
import { FooterDisplayOptions } from './FooterConfigPanel';
import { InteractiveSignatureBox } from './InteractiveSignatureBox';

// Inisialisasi worker pdf.js menggunakan asset url Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Re-ekspor untuk kompatibilitas ke modul lain
export { normalizePdfFontFamily, extractDocumentFontInfo };
export type { DocumentFontInfo };

export interface PdfInteractivePreviewProps {
  pdfFile: File | null;
  pageCount: number;
  currentPage: number;
  onChangeCurrentPage: (page: number) => void;
  signatureMode: SignatureMode;
  visualType: SignatureVisualType;
  placement: SignaturePlacement;
  onChangePlacement: (placement: SignaturePlacement) => void;
  stampFile: File | null;
  onSwitchToForm?: () => void;
  onOpenConfirmSign?: () => void;
  isFormValid?: boolean;
  isVisibleTab?: boolean;
  // Props kompatibilitas
  displayOptions?: FooterDisplayOptions;
  signerName?: string;
  organization?: string;
  targetPageOption?: any;
  specificStartPage?: number;
  specificEndPage?: number;
  coords?: FooterCoordinates;
}

export function PdfInteractivePreview(props: PdfInteractivePreviewProps): JSX.Element {
  const {
    pdfFile,
    pageCount,
    currentPage,
    onChangeCurrentPage,
    signatureMode,
    visualType,
    placement,
    onChangePlacement,
    stampFile,
    onSwitchToForm,
    onOpenConfirmSign,
    isFormValid = true,
    isVisibleTab = true,
  } = props;

  const paperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: A4_WIDTH_PT,
    height: A4_HEIGHT_PT,
  });
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [sheetWidth, setSheetWidth] = useState(360);
  const [isSigBoxSelected, setIsSigBoxSelected] = useState(false);

  const [detectedFont, setDetectedFont] = useState<DocumentFontInfo>({
    fontFamily: '"Bookman Old Style", "Times New Roman", serif',
    fontNameReadable: 'Bookman Old Style',
    fontSizePt: 11,
  });

  // Pantau ukuran kanvas di layar untuk penskalaan presisi
  useEffect(() => {
    if (!paperRef.current) return;
    if (paperRef.current.clientWidth > 0) {
      setSheetWidth(paperRef.current.clientWidth);
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setSheetWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(paperRef.current);
    return () => observer.disconnect();
  }, [isVisibleTab, currentPage]);

  // Muat dokumen PDF ke memory saat berkas dipilih
  useEffect(() => {
    if (!pdfFile) {
      setPdfDoc(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingDoc(true);

    pdfFile
      .arrayBuffer()
      .then((buffer) => {
        if (isCancelled) return;
        return pdfjsLib.getDocument({ data: buffer }).promise;
      })
      .then((doc) => {
        if (isCancelled || !doc) return;
        setPdfDoc(doc);
        setIsLoadingDoc(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Gagal memuat dokumen PDF:', err);
        setIsLoadingDoc(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfFile]);

  // Render halaman aktif PDF ke canvas dan ekstrak tipografi naskah
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;
    setIsRenderingPage(true);

    const targetPageNum = Math.min(Math.max(1, currentPage), pdfDoc.numPages);

    pdfDoc
      .getPage(targetPageNum)
      .then((page) => {
        if (isCancelled || !canvasRef.current) return;

        const originalViewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({
          width: originalViewport.width,
          height: originalViewport.height,
        });

        Promise.allSettled([page.getTextContent(), page.getOperatorList()])
          .then(([tcResult, opResult]) => {
            if (isCancelled) return;
            const textContent = tcResult.status === 'fulfilled' ? tcResult.value : null;
            const opList = opResult.status === 'fulfilled' ? opResult.value : null;
            if (textContent) {
              setDetectedFont(extractDocumentFontInfo(textContent, page, opList));
            }
          })
          .catch((err) => {
            console.warn('Gagal membaca metadata font halaman:', err);
          });

        const renderScale = 1.6;
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const renderTask = page.render({
          canvasContext: ctx,
          viewport: viewport,
        });
        renderTaskRef.current = renderTask;

        return renderTask.promise;
      })
      .then(() => {
        if (!isCancelled) {
          setIsRenderingPage(false);
          if (paperRef.current && paperRef.current.clientWidth > 0) {
            setSheetWidth(paperRef.current.clientWidth);
          }
        }
      })
      .catch((err) => {
        if (err?.name === 'RenderingCancelledException') return;
        if (!isCancelled) {
          console.error('Gagal merender halaman PDF:', err);
          setIsRenderingPage(false);
        }
      });

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, isVisibleTab]);

  const effectiveWidth = pageDimensions.width || A4_WIDTH_PT;
  const effectiveHeight = pageDimensions.height || A4_HEIGHT_PT;
  const aspectRatioVal = effectiveWidth / effectiveHeight;
  const scale = sheetWidth > 0 ? sheetWidth / effectiveWidth : 1;

  const isSignatureOnCurrentPage = placement.page > 0 && currentPage === placement.page;
  const isOutOfBounds =
    placement.x < 0 ||
    placement.y < 0 ||
    placement.x + placement.width > effectiveWidth ||
    placement.y + placement.height > effectiveHeight;

  const stampUrl = useMemo(() => {
    if (!stampFile) return null;
    return URL.createObjectURL(stampFile);
  }, [stampFile]);

  // Reset seleksi saat pindah halaman atau dokumen
  useEffect(() => {
    setIsSigBoxSelected(false);
  }, [pdfFile, currentPage, signatureMode]);

  return (
    <div className="tte-preview-panel">
      {/* Header Panel Pratinjau */}
      <div className="tte-preview-header">
        <div className="tte-preview-title-wrap">
          <h3 className="tte-preview-heading">Pratinjau Dokumen Real</h3>
        </div>

        {/* Kontrol Navigasi Halaman */}
        {pdfFile && pageCount > 0 && (
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
              Pilih dokumen PDF di panel sebelah kiri untuk melihat isi dokumen real, mengatur letak TTE secara interaktif via drag & drop, serta mengatur ukurannya.
            </p>
            <div className="tte-empty-steps-list">
              <div className="tte-empty-step-item">
                <span className="tte-empty-step-num">1</span>
                <span>Pilih berkas dokumen PDF (mulai di Halaman 1)</span>
              </div>
              <div className="tte-empty-step-item">
                <span className="tte-empty-step-num">2</span>
                <span>Pilih Mode TTE: Terlihat (Visible) atau Tak Terlihat (Invisible)</span>
              </div>
              <div className="tte-empty-step-item">
                <span className="tte-empty-step-num">3</span>
                <span>Geser & ubah ukuran kotak tanda tangan di halaman yang dipilih</span>
              </div>
            </div>
          </div>
        ) : (
          /* Lembar Interaktif A4 Dokumen */
          <div className="tte-sheet-scroll-container">
            {/* Status Penempatan & Mode TTE */}
            <div className="tte-sheet-status-bar">
              {signatureMode === 'invisible' ? (
                <span className="tte-status-pill is-invisible-pill" title="Tanda tangan kriptografis tanpa elemen visual di lembar dokumen">
                  <IconEyeOff size={13} aria-hidden="true" />
                  <span>Mode TTE Tak Terlihat (Invisible)</span>
                </span>
              ) : isSignatureOnCurrentPage ? (
                <span className="tte-status-pill is-active-target">
                  <span className="tte-status-dot" aria-hidden="true" />
                  <span>
                    TTE Aktif di Hal. {currentPage} (Drag, Resize & Panah Keyboard ←↑↓→)
                  </span>
                </span>
              ) : placement.page > 0 ? (
                <button
                  type="button"
                  className="tte-status-pill is-inactive-target tte-jump-btn"
                  onClick={() => onChangeCurrentPage(placement.page)}
                  title={`Klik untuk lompat ke halaman ${placement.page}`}
                >
                  <span>TTE ditempatkan di Hal. {placement.page}</span>
                  <strong className="tte-jump-link">
                    Lompat ke Hal. {placement.page} &rarr;
                  </strong>
                </button>
              ) : (
                <span className="tte-status-pill is-inactive-target">
                  <span>Tentukan nomor halaman target pada panel kiri</span>
                </span>
              )}

              {detectedFont.fontNameReadable && (
                <span
                  className="tte-font-pill"
                  title={`Font naskah terdeteksi: ${detectedFont.fontNameReadable} (${detectedFont.fontSizePt} pt).`}
                >
                  Font: <strong>{detectedFont.fontNameReadable}</strong> ({detectedFont.fontSizePt} pt)
                </span>
              )}

              {signatureMode === 'visible' && isOutOfBounds && (
                <span className="tte-warning-pill">
                  <IconAlertTriangle size={13} aria-hidden="true" />
                  <span>Di luar batas halaman</span>
                </span>
              )}
            </div>

            {/* Lembar Dokumen dengan Isi PDF Asli (Canvas) */}
            <div
              ref={paperRef}
              className="tte-a4-sheet"
              style={{
                aspectRatio: `${effectiveWidth} / ${effectiveHeight}`,
                maxWidth: `min(100%, 560px, max(${Math.round(280 * aspectRatioVal)}px, calc((100vh - 290px) * ${aspectRatioVal.toFixed(4)})))`,
              }}
              aria-label={`Lembar Dokumen Halaman ${currentPage}`}
            >
              <canvas ref={canvasRef} className="tte-sheet-canvas" />

              {/* Status Loading Render */}
              {(isLoadingDoc || isRenderingPage) && (
                <div className="tte-sheet-loading-overlay">
                  <span className="tte-sheet-loading-text">Memuat pratinjau halaman {currentPage}...</span>
                </div>
              )}

              {/* KOTAK TTE INTERAKTIF (DRAGGABLE, RESIZABLE & KEYBOARD ACCESSIBLE) */}
              {signatureMode === 'visible' && isSignatureOnCurrentPage && (
                <InteractiveSignatureBox
                  placement={placement}
                  onChangePlacement={onChangePlacement}
                  effectiveWidth={effectiveWidth}
                  effectiveHeight={effectiveHeight}
                  scale={scale}
                  detectedFont={detectedFont}
                  visualType={visualType}
                  stampUrl={stampUrl}
                  isSelected={isSigBoxSelected}
                  onSelect={setIsSigBoxSelected}
                  isOutOfBounds={isOutOfBounds}
                />
              )}
            </div>

            {/* Hint di bawah lembar dokumen */}
            {signatureMode === 'visible' && isSignatureOnCurrentPage && (
              <div
                className={`tte-preview-bottom-hint ${isSigBoxSelected ? 'is-active' : ''}`}
                role="status"
              >
                <IconMove size={13} aria-hidden="true" className="tte-preview-hint-icon" />
                {isSigBoxSelected ? (
                  <span>
                    <strong>Mode ubah aktif:</strong> Geser kotak / tulisan <em>Geser</em> dengan mouse atau panah keyboard (<code>←</code> <code>↑</code> <code>↓</code> <code>→</code>), tarik sudut untuk ubah ukuran, atau klik di luar untuk selesai.
                  </span>
                ) : (
                  <span>
                    <strong>Petunjuk:</strong> Jika ingin mengubah tempat dan ukurannya, <strong>tekan pratinjau QR terlebih dahulu</strong>.
                  </span>
                )}
              </div>
            )}

            {/* Aksi Mobile: Kembali ke Form & Tanda Tangani */}
            {onSwitchToForm && (
              <div className="tte-mobile-preview-actions">
                <button
                  type="button"
                  className="btn btn-secondary tte-mobile-btn-form"
                  onClick={onSwitchToForm}
                >
                  <span>← Ubah Pengaturan</span>
                </button>
                {onOpenConfirmSign && (
                  <button
                    type="button"
                    className="btn btn-primary tte-mobile-btn-sign"
                    disabled={!isFormValid}
                    onClick={onOpenConfirmSign}
                  >
                    <IconCheckCircle size={16} aria-hidden="true" />
                    <span>Tanda Tangani Dokumen</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
