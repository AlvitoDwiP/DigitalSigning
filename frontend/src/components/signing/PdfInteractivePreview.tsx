import { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  IconFileText,
  IconChevronLeft,
  IconChevronRight,
  IconAlertTriangle,
} from '../icons/Icons';
import {
  FooterCoordinates,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  TargetPageOption,
} from '../../utils/pdfHelper';
import { FooterDisplayOptions } from './FooterConfigPanel';

// Inisialisasi worker pdf.js menggunakan asset url Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface DocumentFontInfo {
  fontFamily: string;
  fontNameReadable: string;
  fontSizePt: number;
}

/**
 * Normalisasi nama font teknis dari PDF menjadi CSS font-family ramah browser
 * serta nama terbaca untuk tampilan informasi pengguna.
 */
export function normalizePdfFontFamily(rawName: string): { cssFamily: string; readableName: string } {
  if (!rawName) {
    return {
      cssFamily: '"Bookman Old Style", "URW Bookman", "Times New Roman", serif',
      readableName: 'Bookman Old Style',
    };
  }

  // Hilangkan prefix subsetting PDF (misal: "XJHZPT+BookmanOldStyle" -> "BookmanOldStyle")
  let clean = rawName.replace(/^[A-Z0-9]{6}\+/, '');
  clean = clean.replace(/-(Bold|Italic|Regular|BoldItalic|MT|PSMT|Identity-H)/gi, '');
  clean = clean.replace(/(Bold|Italic|Regular|PSMT|MT|Identity-H)/gi, '').trim();

  const lower = clean.toLowerCase();

  if (lower.includes('bookman')) {
    return {
      cssFamily: '"Bookman Old Style", "URW Bookman", "Bookman", serif',
      readableName: 'Bookman Old Style',
    };
  }
  if (lower.includes('times')) {
    return {
      cssFamily: '"Times New Roman", Times, "Nimbus Roman", serif',
      readableName: 'Times New Roman',
    };
  }
  if (lower.includes('arial')) {
    return {
      cssFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
      readableName: 'Arial',
    };
  }
  if (lower.includes('calibri')) {
    return {
      cssFamily: 'Calibri, Candara, Segoe, "Segoe UI", sans-serif',
      readableName: 'Calibri',
    };
  }
  if (lower.includes('cambria')) {
    return {
      cssFamily: 'Cambria, Georgia, serif',
      readableName: 'Cambria',
    };
  }
  if (lower.includes('georgia')) {
    return {
      cssFamily: 'Georgia, serif',
      readableName: 'Georgia',
    };
  }
  if (lower.includes('garamond')) {
    return {
      cssFamily: 'Garamond, "EB Garamond", serif',
      readableName: 'Garamond',
    };
  }
  if (lower.includes('century')) {
    return {
      cssFamily: '"Century Gothic", "Century Schoolbook", serif',
      readableName: 'Century',
    };
  }
  if (lower.includes('palatino')) {
    return {
      cssFamily: '"Palatino Linotype", Palatino, serif',
      readableName: 'Palatino',
    };
  }
  if (lower.includes('helvetica')) {
    return {
      cssFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      readableName: 'Helvetica',
    };
  }
  if (lower.includes('tahoma')) {
    return {
      cssFamily: 'Tahoma, Verdana, sans-serif',
      readableName: 'Tahoma',
    };
  }
  if (lower.includes('verdana')) {
    return {
      cssFamily: 'Verdana, Geneva, sans-serif',
      readableName: 'Verdana',
    };
  }

  const isSerif = lower.includes('serif') || lower.includes('roman') || lower.includes('minion');
  const fallback = isSerif ? 'serif' : 'sans-serif';
  return {
    cssFamily: `"${clean}", ${fallback}`,
    readableName: clean || (isSerif ? 'Serif' : 'Sans-Serif'),
  };
}

/**
 * Ekstraksi font dominan dan rata-rata ukuran font teks pada halaman PDF
 * Memanfaatkan operatorList dan page.commonObjs untuk resolusi nama font asli (bukan hanya fallback CSS).
 */
export function extractDocumentFontInfo(
  textContent: any,
  page?: any,
  opList?: any
): DocumentFontInfo {
  if (!textContent || !textContent.items || textContent.items.length === 0) {
    return {
      fontFamily: '"Bookman Old Style", "Times New Roman", serif',
      fontNameReadable: 'Bookman Old Style',
      fontSizePt: 11,
    };
  }

  // Petakan font ID ke nama asli font dan ukuran font dari operator list jika tersedia
  const fontIdMap: Record<string, { name: string; size: number }> = {};
  if (opList && page?.commonObjs) {
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] === pdfjsLib.OPS.setFont) {
        const fontId = opList.argsArray[i][0];
        const fontPt = opList.argsArray[i][1];
        if (page.commonObjs.has(fontId)) {
          const fontObj = page.commonObjs.get(fontId);
          fontIdMap[fontId] = {
            name: fontObj.name || fontObj.fallbackName || fontId,
            size: fontPt,
          };
        }
      }
    }
  }

  const fontCounts: Record<string, number> = {};
  const fontSizes: number[] = [];

  for (const item of textContent.items as any[]) {
    if (!item.str || !item.str.trim()) continue;

    // Ambil nama font asli: prioritaskan objek font PDF asli, baru styles, baru fontName
    const resolvedFont =
      fontIdMap[item.fontName]?.name ||
      textContent.styles?.[item.fontName]?.fontFamily ||
      item.fontName ||
      '';

    if (resolvedFont) {
      fontCounts[resolvedFont] = (fontCounts[resolvedFont] || 0) + item.str.length;
    }

    const opPt = fontIdMap[item.fontName]?.size;
    const matrixPt = Math.hypot(item.transform?.[0] || 0, item.transform?.[1] || 0) || Math.abs(item.transform?.[0] || item.height || 0);
    const size = (opPt && opPt > 1 ? opPt : matrixPt) || 0;
    if (size >= 6 && size <= 36) {
      fontSizes.push(size);
    }
  }

  // Cari font paling banyak digunakan berdasarkan jumlah karakter naskah
  let maxCount = 0;
  let dominantFont = '';
  for (const [font, count] of Object.entries(fontCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantFont = font;
    }
  }

  // Cari median ukuran font teks naskah (standar naskah dinas: 11pt - 12pt)
  let medianSize = 11;
  if (fontSizes.length > 0) {
    fontSizes.sort((a, b) => a - b);
    medianSize = Math.round(fontSizes[Math.floor(fontSizes.length / 2)] * 10) / 10;
  }

  const { cssFamily, readableName } = normalizePdfFontFamily(dominantFont);

  return {
    fontFamily: cssFamily,
    fontNameReadable: readableName,
    fontSizePt: medianSize,
  };
}

interface PdfInteractivePreviewProps {
  pdfFile: File | null;
  pageCount: number;
  currentPage: number;
  onChangeCurrentPage: (page: number) => void;
  targetPageOption: TargetPageOption;
  specificStartPage: number;
  specificEndPage: number;
  coords: FooterCoordinates;
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
  specificStartPage,
  specificEndPage,
  coords,
  displayOptions,
  stampFile,
  signerName,
  organization,
}: PdfInteractivePreviewProps) {
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

  // Informasi font yang terdeteksi dari dokumen naskah
  const [detectedFont, setDetectedFont] = useState<DocumentFontInfo>({
    fontFamily: '"Bookman Old Style", "Times New Roman", serif',
    fontNameReadable: 'Bookman Old Style',
    fontSizePt: 11,
  });

  // Pantau perubahan ukuran kanvas di layar untuk penskalaan ukuran teks/QR yang responsif
  useEffect(() => {
    if (!paperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setSheetWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(paperRef.current);
    return () => observer.disconnect();
  }, []);

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
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        return loadingTask.promise;
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

        // Ambil dimensi asli halaman PDF (points)
        const originalViewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({
          width: originalViewport.width,
          height: originalViewport.height,
        });

        // Ekstraksi font dan ukuran dominan dari isi naskah secara akurat dengan textContent & operator list
        Promise.allSettled([page.getTextContent(), page.getOperatorList()])
          .then(([tcResult, opResult]) => {
            if (isCancelled) return;
            const textContent = tcResult.status === 'fulfilled' ? tcResult.value : null;
            const opList = opResult.status === 'fulfilled' ? opResult.value : null;
            if (textContent) {
              const fontInfo = extractDocumentFontInfo(textContent, page, opList);
              setDetectedFont(fontInfo);
            }
          })
          .catch((err) => {
            console.warn('Gagal membaca metadata font halaman:', err);
          });

        // Skala render tajam untuk layar beresolusi tinggi (Retina)
        const renderScale = 1.6;
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Batalkan tugas render sebelumnya jika masih berjalan
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Abaikan jika sudah selesai/dibatalkan
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
        }
      })
      .catch((err) => {
        if (err?.name === 'RenderingCancelledException') {
          return;
        }
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
  }, [pdfDoc, currentPage]);

  // Apakah halaman saat ini adalah halaman yang dibubuhi footer?
  const isFooterOnCurrentPage =
    targetPageOption === 'all' ||
    (targetPageOption === 'last' && currentPage === pageCount) ||
    (targetPageOption === 'specific' && currentPage >= specificStartPage && currentPage <= specificEndPage);

  // Dimensi halaman efektif untuk perhitungan persentase penempatan
  const effectiveWidth = pageDimensions.width || A4_WIDTH_PT;
  const effectiveHeight = pageDimensions.height || A4_HEIGHT_PT;

  // Validasi posisi di luar batas halaman aktif
  const isOutOfBounds =
    coords.llx < 0 ||
    coords.lly < 0 ||
    coords.urx > effectiveWidth ||
    coords.ury > effectiveHeight;

  // Konversi koordinat PDF points ke persentase CSS untuk penempatan presisi
  const boxWidthPct = ((coords.urx - coords.llx) / effectiveWidth) * 100;
  const boxHeightPct = ((coords.ury - coords.lly) / effectiveHeight) * 100;
  const boxLeftPct = (coords.llx / effectiveWidth) * 100;
  const boxBottomPct = (coords.lly / effectiveHeight) * 100;

  // Penskalaan tipografi & QR Code mengikuti font berkas naskah asli
  const scale = sheetWidth > 0 ? sheetWidth / effectiveWidth : 0.6;
  const docPt = detectedFont.fontSizePt || 11;
  const docTextScreenSize = docPt * scale;

  // Ukuran font yang diselaraskan secara presisi dengan hierarki tipografi naskah
  const signerFontSizePx = Math.max(7, Math.round(docPt * 0.96 * scale * 10) / 10);
  const orgFontSizePx = Math.max(6, Math.round(docPt * 0.82 * scale * 10) / 10);
  const timeFontSizePx = Math.max(5.5, Math.round(docPt * 0.72 * scale * 10) / 10);

  // Ukuran QR Code proporsional terhadap ukuran teks naskah (standar BSrE ~3.6x font size naskah)
  const qrSizePt = docPt * 3.6;
  const qrSizePx = Math.max(24, Math.round(qrSizePt * scale));
  const stampMaxHeightPx = qrSizePx;

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
        <div className="tte-preview-title-wrap">
          <h3 className="tte-preview-heading">Pratinjau Dokumen</h3>
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
              Unggah dokumen PDF di panel sebelah kiri untuk melihat isi dokumen dan memverifikasi tampilan footer tanda tangan elektronik secara langsung.
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
        ) : (
          /* Lembar Interaktif A4 dengan Langsung Menampilkan Isi PDF Asli via Canvas */
          <div
            className="tte-sheet-scroll-container"
            onWheel={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Status Penempatan Footer & Indikator Font Berkas */}
            <div className="tte-sheet-status-bar">
              <span className={`tte-status-pill ${isFooterOnCurrentPage ? 'is-active-target' : 'is-inactive-target'}`}>
                {isFooterOnCurrentPage ? (
                  <>
                    <span className="tte-status-dot" aria-hidden="true" />
                    <span>Footer TTE di hal. {currentPage}</span>
                  </>
                ) : (
                  <span>
                    Footer TTE tidak aktif di hal. {currentPage}
                  </span>
                )}
              </span>

              {detectedFont.fontNameReadable && (
                <span
                  className="tte-font-pill"
                  title={`Font naskah terdeteksi: ${detectedFont.fontNameReadable} (${detectedFont.fontSizePt} pt). Ukuran font dan QR diselaraskan otomatis.`}
                >
                  Font: <strong>{detectedFont.fontNameReadable}</strong> ({detectedFont.fontSizePt} pt)
                </span>
              )}

              {isOutOfBounds && (
                <span className="tte-warning-pill">
                  <IconAlertTriangle size={13} aria-hidden="true" />
                  <span>Posisi di luar batas halaman</span>
                </span>
              )}
            </div>

            {/* Lembar Dokumen dengan Isi PDF Asli (Canvas) dan Footer TTE di atasnya */}
            <div
              ref={paperRef}
              className="tte-a4-sheet"
              style={{
                aspectRatio: `${effectiveWidth} / ${effectiveHeight}`,
              }}
              aria-label={`Lembar Dokumen Halaman ${currentPage}`}
            >
              <canvas
                ref={canvasRef}
                className="tte-sheet-canvas"
              />

              {/* Status Loading Render */}
              {(isLoadingDoc || isRenderingPage) && (
                <div className="tte-sheet-loading-overlay">
                  <span className="tte-sheet-loading-text">Memuat pratinjau...</span>
                </div>
              )}

              {/* Kotak Footer TTE (Mengikuti Font & Skala Berkas Naskah) */}
              {isFooterOnCurrentPage && (
                <div
                  className={`tte-footer-box ${isOutOfBounds ? 'is-out' : ''}`}
                  style={{
                    left: `${boxLeftPct}%`,
                    bottom: `${boxBottomPct}%`,
                    width: `${boxWidthPct}%`,
                    height: `${boxHeightPct}%`,
                    fontFamily: detectedFont.fontFamily,
                  }}
                  role="region"
                  aria-label="Kotak Footer TTE"
                >
                  <div
                    className="tte-footer-inner"
                    style={{
                      gap: `${Math.max(4, Math.round(docTextScreenSize * 0.45))}px`,
                    }}
                  >
                    {/* QR Code Verifikasi Proporsional */}
                    {displayOptions.showQr && (
                      <div
                        className="tte-footer-qr"
                        style={{
                          width: `${qrSizePx}px`,
                          height: `${qrSizePx}px`,
                          minWidth: `${qrSizePx}px`,
                          minHeight: `${qrSizePx}px`,
                        }}
                        aria-hidden="true"
                        title={`QR Code Verifikasi (~${Math.round(qrSizePt)} pt)`}
                      >
                        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
                          <rect x="2" y="2" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          <rect x="4" y="4" width="3" height="3" fill="currentColor" />
                          <rect x="15" y="2" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          <rect x="17" y="4" width="3" height="3" fill="currentColor" />
                          <rect x="2" y="15" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          <rect x="4" y="17" width="3" height="3" fill="currentColor" />
                          <rect x="11" y="11" width="2" height="2" fill="currentColor" />
                          <rect x="15" y="11" width="3" height="2" fill="currentColor" />
                          <rect x="11" y="15" width="2" height="3" fill="currentColor" />
                          <rect x="15" y="15" width="3" height="3" fill="currentColor" />
                          <rect x="19" y="19" width="3" height="3" fill="currentColor" />
                        </svg>
                      </div>
                    )}

                    {/* Gambar Tanda Tangan jika ada */}
                    {stampUrl && (
                      <div
                        className="tte-footer-stamp-thumb"
                        style={{
                          maxHeight: `${stampMaxHeightPx}px`,
                        }}
                        aria-hidden="true"
                        title="Tanda Tangan Visual"
                      >
                        <img src={stampUrl} alt="Stempel tanda tangan" />
                      </div>
                    )}

                    {/* Informasi Teks Footer (Mengikuti Tipografi Berkas Naskah) */}
                    <div className="tte-footer-texts">
                      {displayOptions.showSignerName && (
                        <strong
                          className="tte-footer-signer-name"
                          style={{ fontSize: `${signerFontSizePx}px` }}
                          title={signerName}
                        >
                          {signerName}
                        </strong>
                      )}

                      {displayOptions.showOrganization && (
                        <span
                          className="tte-footer-org"
                          style={{ fontSize: `${orgFontSizePx}px` }}
                          title={organization}
                        >
                          {organization}
                        </span>
                      )}

                      {displayOptions.showTimestamp && (
                        <span
                          className="tte-footer-time"
                          style={{ fontSize: `${timeFontSizePx}px` }}
                          title={`${currentDateStr} ${currentTimeStr} WIB`}
                        >
                          {currentDateStr} {currentTimeStr} WIB
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
