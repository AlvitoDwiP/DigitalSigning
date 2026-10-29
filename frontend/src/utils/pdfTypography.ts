import * as pdfjsLib from 'pdfjs-dist';

export interface DocumentFontInfo {
  fontFamily: string;
  fontNameReadable: string;
  fontSizePt: number;
}

const KNOWN_FONTS: Array<{ key: string; css: string; readable: string }> = [
  { key: 'bookman', css: '"Bookman Old Style", "URW Bookman", "Bookman", serif', readable: 'Bookman Old Style' },
  { key: 'times', css: '"Times New Roman", Times, "Nimbus Roman", serif', readable: 'Times New Roman' },
  { key: 'arial', css: 'Arial, "Helvetica Neue", Helvetica, sans-serif', readable: 'Arial' },
  { key: 'calibri', css: 'Calibri, Candara, Segoe, "Segoe UI", sans-serif', readable: 'Calibri' },
  { key: 'cambria', css: 'Cambria, Georgia, serif', readable: 'Cambria' },
  { key: 'georgia', css: 'Georgia, serif', readable: 'Georgia' },
  { key: 'garamond', css: 'Garamond, "EB Garamond", serif', readable: 'Garamond' },
  { key: 'century', css: '"Century Gothic", "Century Schoolbook", serif', readable: 'Century' },
  { key: 'palatino', css: '"Palatino Linotype", Palatino, serif', readable: 'Palatino' },
  { key: 'helvetica', css: '"Helvetica Neue", Helvetica, Arial, sans-serif', readable: 'Helvetica' },
  { key: 'tahoma', css: 'Tahoma, Verdana, sans-serif', readable: 'Tahoma' },
  { key: 'verdana', css: 'Verdana, Geneva, sans-serif', readable: 'Verdana' },
];

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
  for (const font of KNOWN_FONTS) {
    if (lower.includes(font.key)) {
      return { cssFamily: font.css, readableName: font.readable };
    }
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

    const resolvedFont =
      fontIdMap[item.fontName]?.name ||
      textContent.styles?.[item.fontName]?.fontFamily ||
      item.fontName ||
      '';

    if (resolvedFont) {
      fontCounts[resolvedFont] = (fontCounts[resolvedFont] || 0) + item.str.length;
    }

    const opPt = fontIdMap[item.fontName]?.size;
    const matrixPt =
      Math.hypot(item.transform?.[0] || 0, item.transform?.[1] || 0) ||
      Math.abs(item.transform?.[0] || item.height || 0);
    const size = (opPt && opPt > 1 ? opPt : matrixPt) || 0;
    if (size >= 6 && size <= 36) {
      fontSizes.push(size);
    }
  }

  let maxCount = 0;
  let dominantFont = '';
  for (const [font, count] of Object.entries(fontCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantFont = font;
    }
  }

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

