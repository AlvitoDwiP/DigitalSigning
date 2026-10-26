/**
 * Utilitas pemrosesan informasi dan kalkulasi posisi dokumen PDF untuk TTE.
 */

export interface FooterCoordinates {
  llx: number; // Lower-left X (points)
  lly: number; // Lower-left Y (points)
  urx: number; // Upper-right X (points)
  ury: number; // Upper-right Y (points)
}

// Standar dimensi lembar A4 dalam sistem koordinat Postscript / PDF points (72 pt per inch)
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

// Default dimensi footer TTE (Lebar ~220 pt, Tinggi ~70 pt)
export const DEFAULT_FOOTER_WIDTH = 220;
export const DEFAULT_FOOTER_HEIGHT = 70;

export type FooterPositionPreset = 'bottom-left' | 'bottom-center' | 'bottom-right';

export type TargetPageOption = 'all' | 'last' | 'specific';

/**
 * Menghitung koordinat berdasarkan preset posisi cepat pada lembar A4.
 */
export function getPresetCoordinates(preset: FooterPositionPreset): FooterCoordinates {
  const marginX = 36;
  const marginY = 36;
  const width = DEFAULT_FOOTER_WIDTH;
  const height = DEFAULT_FOOTER_HEIGHT;

  switch (preset) {
    case 'bottom-left':
      return {
        llx: marginX,
        lly: marginY,
        urx: marginX + width,
        ury: marginY + height,
      };
    case 'bottom-center': {
      const centerX = (A4_WIDTH_PT - width) / 2;
      return {
        llx: Math.round(centerX),
        lly: marginY,
        urx: Math.round(centerX + width),
        ury: marginY + height,
      };
    }
    case 'bottom-right':
    default: {
      const rightX = A4_WIDTH_PT - marginX - width;
      return {
        llx: Math.round(rightX),
        lly: marginY,
        urx: Math.round(rightX + width),
        ury: marginY + height,
      };
    }
  }
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
