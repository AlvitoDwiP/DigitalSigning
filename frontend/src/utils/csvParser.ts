export interface ParsedCsvRow {
  rowNumber: number;
  name: string;
  nik: string;
  email: string;
  organization: string;
  ou: string;
  isValid: boolean;
  errors: string[];
}

export interface ClientCsvValidationResult {
  isValid: boolean;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  headerError?: string;
  rows: ParsedCsvRow[];
}

export const EXPECTED_CSV_HEADERS = [
  'name',
  'nik',
  'email',
  'organization',
  'ou',
  'password',
  'pfx_pass',
];

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function validateCsvContent(rawText: string): ClientCsvValidationResult {
  // Strip UTF-8 BOM if present
  let cleanText = rawText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  // Split lines
  const rawLines = cleanText.split(/\r\n|\n|\r/);
  const nonEmptyLines = rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (nonEmptyLines.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      headerError: 'Berkas CSV kosong atau tidak memiliki data.',
      rows: [],
    };
  }

  // Validate Header
  const headerCols = parseCsvLine(nonEmptyLines[0]).map((h) => h.toLowerCase());
  const headerMatches =
    headerCols.length === EXPECTED_CSV_HEADERS.length &&
    EXPECTED_CSV_HEADERS.every((expected, idx) => headerCols[idx] === expected);

  if (!headerMatches) {
    return {
      isValid: false,
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      headerError: `Header CSV tidak sesuai. Wajib berisi 7 kolom: ${EXPECTED_CSV_HEADERS.join(', ')}`,
      rows: [],
    };
  }

  const dataLines = nonEmptyLines.slice(1);
  if (dataLines.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      headerError: 'Berkas CSV hanya berisi header tanpa baris data pengguna.',
      rows: [],
    };
  }

  const parsedRows: ParsedCsvRow[] = [];
  const seenNiks = new Set<string>();
  const seenEmails = new Set<string>();

  dataLines.forEach((lineText, idx) => {
    const rowNumber = idx + 1;
    const cols = parseCsvLine(lineText);
    const errors: string[] = [];

    if (cols.length !== 7) {
      errors.push(`Format kolom tidak sesuai (ditemukan ${cols.length} kolom, diharapkan 7 kolom).`);
      parsedRows.push({
        rowNumber,
        name: cols[0] || '-',
        nik: cols[1] || '-',
        email: cols[2] || '-',
        organization: cols[3] || '-',
        ou: cols[4] || '-',
        isValid: false,
        errors,
      });
      return;
    }

    const [name, nik, email, organization, ou, password, pfxPass] = cols;

    // 1. Name
    if (!name) {
      errors.push('Nama lengkap wajib diisi.');
    }

    // 2. NIK
    if (!nik) {
      errors.push('NIK wajib diisi.');
    } else if (!/^[0-9]{16}$/.test(nik)) {
      errors.push('NIK harus tepat 16 digit angka.');
    } else if (seenNiks.has(nik)) {
      errors.push('NIK duplikat di dalam berkas CSV.');
    } else {
      seenNiks.add(nik);
    }

    // 3. Email
    if (!email) {
      errors.push('Alamat email wajib diisi.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Format alamat email tidak valid.');
    } else if (seenEmails.has(email.toLowerCase())) {
      errors.push('Email duplikat di dalam berkas CSV.');
    } else {
      seenEmails.add(email.toLowerCase());
    }

    // 4. Organization
    if (!organization) {
      errors.push('Instansi / Organisasi wajib diisi.');
    }

    // 5. OU
    if (!ou) {
      errors.push('Unit Organisasi (OU) wajib diisi.');
    }

    // 6. Password Login
    if (!password) {
      errors.push('Password login wajib diisi.');
    } else if (password.length < 8) {
      errors.push('Password login minimal 8 karakter.');
    } else if (!/[A-Z]/.test(password)) {
      errors.push('Password login harus memiliki minimal 1 huruf kapital (A-Z).');
    } else if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password login harus memiliki minimal 1 simbol / non-alphanumeric.');
    }

    // 7. Passphrase
    if (!pfxPass) {
      errors.push('Passphrase wajib diisi.');
    } else if (pfxPass.length < 8) {
      errors.push('Passphrase minimal 8 karakter.');
    }

    const isValid = errors.length === 0;

    parsedRows.push({
      rowNumber,
      name,
      nik,
      email,
      organization,
      ou,
      isValid,
      errors,
    });
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return {
    isValid: invalidCount === 0,
    totalRows: parsedRows.length,
    validCount,
    invalidCount,
    rows: parsedRows,
  };
}
