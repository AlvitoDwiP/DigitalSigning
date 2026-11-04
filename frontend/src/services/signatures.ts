import { getAuthToken, ApiError } from './api';

export interface SignPdfVisibleParams {
  pdf: File;
  stamp?: File | Blob | null;
  page: number;
  llx?: number;
  lly?: number;
  urx?: number;
  ury?: number;
  passphrase: string;
  nik?: string;
}

export interface SignPdfInvisibleParams {
  pdf: File;
  passphrase: string;
  nik?: string;
}

export interface SignDocumentParams {
  pdf: File;
  stamp?: File | Blob | null;
  page?: number;
  llx?: number;
  lly?: number;
  urx?: number;
  ury?: number;
  visible?: boolean;
  passphrase: string;
  nik?: string;
}

export interface SignDocumentResult {
  blob: Blob;
  filename: string;
}

async function handleSigningResponse(response: Response): Promise<SignDocumentResult> {
  if (!response.ok) {
    let errDetail: any = null;
    let message = 'Terjadi kesalahan saat memproses penandatanganan dokumen.';
    let code = 'INTERNAL_ERROR';
    try {
      errDetail = await response.json();
      if (errDetail?.error?.message) {
        message = errDetail.error.message;
      } else if (errDetail?.detail?.message) {
        message = errDetail.detail.message;
      } else if (typeof errDetail?.detail === 'string') {
        message = errDetail.detail;
      }
      code = errDetail?.error?.code || errDetail?.detail?.code || code;
    } catch {
      // Non-json response
    }
    throw new ApiError(message, response.status, code, errDetail);
  }

  const blob = await response.blob();
  let filename = 'dokumen_signed.pdf';
  const disposition = response.headers.get('Content-Disposition');
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  return { blob, filename };
}

/**
 * Melakukan penandatanganan PDF digital dengan representasi visual (Visible TTE).
 * Endpoint: POST /api/v1/signatures/visible
 */
export async function signPdfVisible(params: SignPdfVisibleParams): Promise<SignDocumentResult> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('pdf', params.pdf);
  if (params.stamp) {
    const stampFilename = params.stamp instanceof File ? params.stamp.name : 'stamp.png';
    formData.append('stamp', params.stamp, stampFilename);
  }
  formData.append('page', String(params.page || 1));
  if (params.llx !== undefined) formData.append('llx', String(params.llx));
  if (params.lly !== undefined) formData.append('lly', String(params.lly));
  if (params.urx !== undefined) formData.append('urx', String(params.urx));
  if (params.ury !== undefined) formData.append('ury', String(params.ury));
  formData.append('passphrase', params.passphrase);
  if (params.nik) {
    formData.append('nik', params.nik.trim());
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch('/api/v1/signatures/visible', {
      method: 'POST',
      headers,
      body: formData,
    });
    return await handleSigningResponse(response);
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      'Gagal menghubungi server penandatanganan visible. Periksa koneksi Anda.',
      0,
      'NETWORK_ERROR',
      err,
      true
    );
  }
}

/**
 * Melakukan penandatanganan PDF digital secara kriptografis tanpa representasi visual (Invisible TTE).
 * Endpoint: POST /api/v1/signatures/invisible
 */
export async function signPdfInvisible(params: SignPdfInvisibleParams): Promise<SignDocumentResult> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('pdf', params.pdf);
  formData.append('passphrase', params.passphrase);
  if (params.nik) {
    formData.append('nik', params.nik.trim());
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch('/api/v1/signatures/invisible', {
      method: 'POST',
      headers,
      body: formData,
    });
    return await handleSigningResponse(response);
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      'Gagal menghubungi server penandatanganan invisible. Periksa koneksi Anda.',
      0,
      'NETWORK_ERROR',
      err,
      true
    );
  }
}

/**
 * Wrapper serbaguna / kompatibilitas mundur untuk menandatangani dokumen PDF.
 */
export async function signPdfDocument(params: SignDocumentParams): Promise<SignDocumentResult> {
  if (params.visible === false) {
    return signPdfInvisible({
      pdf: params.pdf,
      passphrase: params.passphrase,
      nik: params.nik,
    });
  }
  return signPdfVisible({
    pdf: params.pdf,
    stamp: params.stamp,
    page: params.page || 1,
    llx: params.llx,
    lly: params.lly,
    urx: params.urx,
    ury: params.ury,
    passphrase: params.passphrase,
    nik: params.nik,
  });
}
