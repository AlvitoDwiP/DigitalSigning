import { getAuthToken, ApiError } from './api';

export interface SignDocumentParams {
  pdf: File;
  stamp?: File | Blob | null;
  page: number;
  llx?: number;
  lly?: number;
  urx?: number;
  ury?: number;
  visible?: boolean;
  passphrase: string;
  nik?: string; // Khusus role ADMIN jika menandatangani atas nama NIK lain
}

export interface SignDocumentResult {
  blob: Blob;
  filename: string;
}

export async function signPdfDocument(params: SignDocumentParams): Promise<SignDocumentResult> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('pdf', params.pdf);
  if (params.stamp) {
    const stampFilename = params.stamp instanceof File ? params.stamp.name : 'qr_stamp.png';
    formData.append('stamp', params.stamp, stampFilename);
  }
  formData.append('page', String(params.page || 1));
  if (params.llx !== undefined) formData.append('llx', String(params.llx));
  if (params.lly !== undefined) formData.append('lly', String(params.lly));
  if (params.urx !== undefined) formData.append('urx', String(params.urx));
  if (params.ury !== undefined) formData.append('ury', String(params.ury));
  if (params.visible !== undefined) {
    formData.append('visible', String(params.visible));
  }
  formData.append('passphrase', params.passphrase);
  if (params.nik) {
    formData.append('nik', params.nik.trim());
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch('/api/v1/signatures/sign', {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (err: any) {
    throw new ApiError(
      'Gagal menghubungi server penandatanganan. Periksa koneksi Anda.',
      0,
      'NETWORK_ERROR',
      err,
      true
    );
  }

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
