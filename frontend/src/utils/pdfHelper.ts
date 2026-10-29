/**
 * Utilitas pemrosesan informasi dan kalkulasi posisi dokumen PDF untuk TTE.
 */

export type SignatureMode = 'visible' | 'invisible';
export type SignatureVisualType = 'qr_text' | 'image';

export interface SignaturePlacement {
  page: number; // 1-indexed target page (satu halaman saja)
  x: number; // PDF points dari kiri (0 s.d. page_width - width)
  y: number; // PDF points dari bawah (0 s.d. page_height - height)
  width: number; // PDF points lebar kotak
  height: number; // PDF points tinggi kotak
}

export interface FooterCoordinates {
  llx: number; // Lower-left X (points)
  lly: number; // Lower-left Y (points)
  urx: number; // Upper-right X (points)
  ury: number; // Upper-right Y (points)
}

// Standar dimensi lembar A4 dalam sistem koordinat Postscript / PDF points (72 pt per inch)
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

// Default dimensi kotak tanda tangan elektronik (TTE)
export const DEFAULT_TTE_WIDTH = 100;
export const DEFAULT_TTE_HEIGHT = 100;
export const MIN_TTE_WIDTH = 45;
export const MIN_TTE_HEIGHT = 45;
export const MAX_TTE_WIDTH = 380;
export const MAX_TTE_HEIGHT = 260;

// Default dimensi footer lama untuk kompatibilitas
export const DEFAULT_FOOTER_WIDTH = DEFAULT_TTE_WIDTH;
export const DEFAULT_FOOTER_HEIGHT = DEFAULT_TTE_HEIGHT;

export type FooterPositionPreset = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-right' | 'center';
export type TargetPageOption = 'all' | 'last' | 'specific';

/**
 * Buat penempatan default untuk satu halaman spesifik (default: Halaman 1, pojok kanan bawah)
 */
export function getDefaultPlacement(
  page: number = 1,
  pageWidth: number = A4_WIDTH_PT,
  _pageHeight: number = A4_HEIGHT_PT
): SignaturePlacement {
  const margin = 36;
  const width = DEFAULT_TTE_WIDTH;
  const height = DEFAULT_TTE_HEIGHT;
  return {
    page,
    x: Math.round(pageWidth - margin - width),
    y: margin,
    width,
    height,
  };
}

/**
 * Menghitung koordinat berdasarkan preset posisi cepat pada lembar dokumen.
 */
export function getPresetPlacement(
  preset: FooterPositionPreset,
  page: number = 1,
  pageWidth: number = A4_WIDTH_PT,
  pageHeight: number = A4_HEIGHT_PT,
  boxWidth: number = DEFAULT_TTE_WIDTH,
  boxHeight: number = DEFAULT_TTE_HEIGHT
): SignaturePlacement {
  const marginX = 36;
  const marginY = 36;
  const w = Math.min(boxWidth, pageWidth - marginX * 2);
  const h = Math.min(boxHeight, pageHeight - marginY * 2);

  switch (preset) {
    case 'bottom-left':
      return { page, x: marginX, y: marginY, width: w, height: h };
    case 'bottom-center':
      return { page, x: Math.round((pageWidth - w) / 2), y: marginY, width: w, height: h };
    case 'top-right':
      return { page, x: Math.round(pageWidth - marginX - w), y: Math.round(pageHeight - marginY - h), width: w, height: h };
    case 'center':
      return { page, x: Math.round((pageWidth - w) / 2), y: Math.round((pageHeight - h) / 2), width: w, height: h };
    case 'bottom-right':
    default:
      return { page, x: Math.round(pageWidth - marginX - w), y: marginY, width: w, height: h };
  }
}

/**
 * Konversi SignaturePlacement ke FooterCoordinates (llx, lly, urx, ury)
 */
export function placementToCoordinates(placement: SignaturePlacement): FooterCoordinates {
  return {
    llx: Math.round(placement.x),
    lly: Math.round(placement.y),
    urx: Math.round(placement.x + placement.width),
    ury: Math.round(placement.y + placement.height),
  };
}

/**
 * Menghitung koordinat berdasarkan preset posisi cepat pada lembar A4 (kompatibilitas lama).
 */
export function getPresetCoordinates(preset: FooterPositionPreset): FooterCoordinates {
  const p = getPresetPlacement(preset, 1, A4_WIDTH_PT, A4_HEIGHT_PT);
  return placementToCoordinates(p);
}

/**
 * Ekstraksi jumlah halaman PDF langsung di sisi klien secara instan (0 dependency).
 */
export async function countPdfPages(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    // Membaca representasi biner untuk menemukan metadata objek PDF
    const bytes = new Uint8Array(buffer);
    let str = '';
    // Baca hingga 2MB pertama atau seluruh berkas untuk efisiensi
    const readLimit = Math.min(bytes.length, 2 * 1024 * 1024);
    for (let i = 0; i < readLimit; i++) {
      str += String.fromCharCode(bytes[i]);
    }

    // Pola 1: /Type /Pages /Count N
    const countMatch = str.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
    if (countMatch && parseInt(countMatch[1], 10) > 0) {
      return parseInt(countMatch[1], 10);
    }

    // Pola 2: Hitung kemunculan objek /Type /Page (tanpa s)
    const pageMatches = str.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }

    return 1;
  } catch {
    return 1;
  }
}

/**
 * Format ukuran file ramah pengguna (KB atau MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

/**
 * Render visual stempel QR Code + metadata resmi menjadi PNG Blob berkualitas tinggi
 * untuk dikirimkan ke server penandatanganan PDF.
 */
export async function generateQrStampBlob(params: {
  signerName?: string;
  organization?: string;
  dateStr?: string;
  width: number;
  height: number;
  fontFamily?: string;
}): Promise<Blob> {
  // Resolusi Ultra-HD (minimal 1600px) agar QR Code dan Logo MKRI (447x447) tampil tajam saat di-zoom di PDF
  const minTargetPx = 1600;
  const minDimPt = Math.max(1, Math.min(params.width, params.height));
  const scale = Math.max(12, Math.ceil(minTargetPx / minDimPt));
  const w = Math.round(params.width * scale);
  const h = Math.round(params.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Latar belakang putih bersih (#ffffff) agar di pembaca PDF (PDFgear / Acrobat)
  // warna highlight biru form-field /Widget di bawah /AP tidak tembus ke sela-sela QR Code
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Render SVG QR code FULL memenuhi canvas secara proporsional
  const qrSize = Math.min(w, h);
  const qrX = Math.round((w - qrSize) / 2);
  const qrY = Math.round((h - qrSize) / 2);

  const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${qrSize}" height="${qrSize}" viewBox="0 0 25 25" shape-rendering="crispEdges" fill="#0f172a">
    <!-- Finder pattern 1 (Top-Left) -->
    <rect x="1" y="1" width="7" height="7" rx="0.8" fill="none" stroke="#0f172a" stroke-width="1.4" />
    <rect x="3" y="3" width="3" height="3" fill="#0f172a" />
    <!-- Finder pattern 2 (Top-Right) -->
    <rect x="17" y="1" width="7" height="7" rx="0.8" fill="none" stroke="#0f172a" stroke-width="1.4" />
    <rect x="19" y="3" width="3" height="3" fill="#0f172a" />
    <!-- Finder pattern 3 (Bottom-Left) -->
    <rect x="1" y="17" width="7" height="7" rx="0.8" fill="none" stroke="#0f172a" stroke-width="1.4" />
    <rect x="3" y="19" width="3" height="3" fill="#0f172a" />
    <!-- Timing patterns -->
    <rect x="9" y="4" width="1.2" height="1.2" fill="#0f172a" />
    <rect x="11" y="4" width="1.2" height="1.2" fill="#0f172a" />
    <rect x="13" y="4" width="1.2" height="1.2" fill="#0f172a" />
    <rect x="15" y="4" width="1.2" height="1.2" fill="#0f172a" />
    <rect x="4" y="9" width="1.2" height="1.2" fill="#0f172a" />
    <rect x="4" y="11" width="1.2" height="1.2" fill="#0f172a" />
    <rect x="4" y="13" width="1.2" height="1.2" fill="#0f172a" />
    <rect x="4" y="15" width="1.2" height="1.2" fill="#0f172a" />
    <!-- Alignment pattern (Bottom-Right) -->
    <rect x="17" y="17" width="5" height="5" rx="0.5" fill="none" stroke="#0f172a" stroke-width="1.2" />
    <rect x="19" y="19" width="1" height="1" fill="#0f172a" />
    <!-- Data modules -->
    <rect x="9" y="1" width="1.2" height="2.4" fill="#0f172a" />
    <rect x="11" y="2" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="14" y="1" width="1.2" height="2.4" fill="#0f172a" />
    <rect x="1" y="9" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="2" y="12" width="1.2" height="2.4" fill="#0f172a" />
    <rect x="1" y="15" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="9" y="7" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="13" y="7" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="7" y="9" width="1.2" height="2.4" fill="#0f172a" />
    <rect x="7" y="13" width="1.2" height="2.4" fill="#0f172a" />
    <rect x="17" y="9" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="21" y="10" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="18" y="13" width="1.2" height="2.4" fill="#0f172a" />
    <rect x="22" y="14" width="1.2" height="2.4" fill="#0f172a" />
    <rect x="9" y="17" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="13" y="18" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="10" y="21" width="1.2" height="2.4" fill="#0f172a" />
    <rect x="13" y="22" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="17" y="23" width="2.4" height="1.2" fill="#0f172a" />
    <rect x="21" y="22" width="2.4" height="1.2" fill="#0f172a" />
  </svg>`;

  const qrImg = new Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const qrUrl = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve) => {
    qrImg.onload = () => {
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      URL.revokeObjectURL(qrUrl);
      resolve();
    };
    qrImg.onerror = () => {
      URL.revokeObjectURL(qrUrl);
      resolve();
    };
    qrImg.src = qrUrl;
  });

  // Gambar Logo MKRI HD di tengah QR Code (mengambil dari public/logo.png)
  const logoImg = new Image();
  await new Promise<void>((resolve) => {
    logoImg.onload = () => resolve();
    logoImg.onerror = () => resolve();
    logoImg.src = '/logo.png';
  });

  if (logoImg.complete && logoImg.naturalWidth > 0) {
    const badgeSize = Math.round(qrSize * 0.30);
    const badgeX = Math.round((w - badgeSize) / 2);
    const badgeY = Math.round((h - badgeSize) / 2);
    const radius = badgeSize / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Lingkaran alas putih tipis sebagai pemisah bersih di sekitar cincin emas logo MKRI
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Gambar logo MKRI resolusi penuh di dalam lingkaran alas
    const pad = Math.max(2, Math.round(badgeSize * 0.045));
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius - pad, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, badgeX + pad, badgeY + pad, badgeSize - pad * 2, badgeSize - pad * 2);
    ctx.restore();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal menghasilkan blob stempel'));
    }, 'image/png');
  });
}

