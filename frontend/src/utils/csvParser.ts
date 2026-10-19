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

  // Validate Header: support both standard 7-col and alternative 6-col (org,ou,cn,email,nik,pfx_pass)
  const headerCols = parseCsvLine(nonEmptyLines[0]).map((h) => h.toLowerCase());
  const isStandard7Col =
    headerCols.length === EXPECTED_CSV_HEADERS.length &&
    EXPECTED_CSV_HEADERS.every((expected, idx) => headerCols[idx] === expected);
  const isAlt6Col =
    headerCols.length === 6 &&
    ['org', 'ou', 'cn', 'email', 'nik', 'pfx_pass'].every((expected, idx) => headerCols[idx] === expected || (expected === 'org' && headerCols[idx] === 'organization'));

  if (!isStandard7Col && !isAlt6Col) {
    return {
      isValid: false,
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      headerError: `Header CSV tidak sesuai. Gunakan: ${EXPECTED_CSV_HEADERS.join(', ')} atau org,ou,cn,email,nik,pfx_pass`,
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
  const seenNames = new Set<string>();
  const seenNiks = new Set<string>();
  const seenEmails = new Set<string>();

  dataLines.forEach((lineText, idx) => {
    const rowNumber = idx + 1;
    const cols = parseCsvLine(lineText);
    const errors: string[] = [];
    const expectedCols = isStandard7Col ? 7 : 6;

    if (cols.length !== expectedCols) {
      errors.push(`Format kolom tidak sesuai (ditemukan ${cols.length} kolom, diharapkan ${expectedCols} kolom).`);
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

    let name = '';
    let nik = '';
    let email = '';
    let organization = '';
    let ou = '';
    let password = '';
    let pfxPass = '';

    if (isStandard7Col) {
      [name, nik, email, organization, ou, password, pfxPass] = cols;
    } else {
      [organization, ou, name, email, nik, pfxPass] = cols;
    }

    const cleanName = name.trim();
    const cleanNik = nik.trim();
    const cleanEmail = email.trim();

    // 1. Name
    if (!cleanName) {
      errors.push('Nama lengkap wajib diisi.');
    } else if (seenNames.has(cleanName.toLowerCase())) {
      errors.push('Nama lengkap duplikat di dalam berkas CSV.');
    } else {
      seenNames.add(cleanName.toLowerCase());
    }

    // 2. NIK
    if (!cleanNik) {
      errors.push('NIK wajib diisi.');
    } else if (!/^[0-9]{16}$/.test(cleanNik)) {
      errors.push('NIK harus tepat 16 digit angka.');
    } else if (seenNiks.has(cleanNik)) {
      errors.push('NIK duplikat di dalam berkas CSV.');
    } else {
      seenNiks.add(cleanNik);
    }

    // 3. Email
    if (!cleanEmail) {
      errors.push('Alamat email wajib diisi.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.push('Format alamat email tidak valid.');
    } else if (seenEmails.has(cleanEmail.toLowerCase())) {
      errors.push('Email duplikat di dalam berkas CSV.');
    } else {
      seenEmails.add(cleanEmail.toLowerCase());
    }

    // Check Nama dan Email tidak boleh sama
    if (cleanName && cleanEmail && cleanName.toLowerCase() === cleanEmail.toLowerCase()) {
      errors.push('Nama dan email tidak boleh sama.');
    }

    // 4. Organization
    if (!organization) {
      errors.push('Instansi / Organisasi wajib diisi.');
    }

    // 5. OU
    if (!ou) {
      errors.push('Unit Organisasi (OU) wajib diisi.');
    }

    // 6. Password Login (jika diisi, validasi policy; jika kosong, akan digenerate otomatis)
    if (password && password.trim()) {
      if (password.length < 8) {
        errors.push('Password login minimal 8 karakter.');
      } else if (!/[A-Z]/.test(password)) {
        errors.push('Kata sandi harus memiliki minimal satu huruf kapital.');
      } else if (!/[^a-zA-Z0-9]/.test(password)) {
        errors.push('Kata sandi harus memiliki minimal satu simbol.');
      }
    }

    // 7. Passphrase (jika diisi, validasi policy; jika kosong, akan digenerate otomatis)
    if (pfxPass && pfxPass.trim()) {
      if (pfxPass.length < 8) {
        errors.push('Passphrase minimal 8 karakter.');
      }
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
