const TOKEN_STORAGE_KEY = 'ds_auth_token';
const USER_STORAGE_KEY = 'ds_auth_user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER' | string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: AuthUser;
    token: string;
  };
  detail?: string;
  message?: string;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('access_token') || localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem('access_token', token);
  } catch {
    // Storage access blocked
  }
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('auth_user') || localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Storage access blocked or invalid json
  }
  return null;
}

export function setAuthUser(user: AuthUser): void {
  try {
    const val = JSON.stringify(user);
    localStorage.setItem(USER_STORAGE_KEY, val);
    localStorage.setItem('auth_user', val);
  } catch {
    // Storage access blocked
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
  } catch {
    // Storage access blocked
  }
}

export class ApiError extends Error {
  status?: number;
  isNetworkError: boolean;
  code?: string;
  detail?: any;

  constructor(
    message: string,
    status?: number,
    code?: string,
    detail?: any,
    isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.isNetworkError = isNetworkError;
  }
}

export async function requestApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch (err: any) {
    // Distinguish network drop / offline / DNS failure
    throw new ApiError(
      'Layanan sedang tidak dapat dihubungi. Periksa koneksi Anda atau coba kembali beberapa saat lagi.',
      undefined,
      'NETWORK_ERROR',
      undefined,
      true
    );
  }

  // Handle 401 unauthorized session expiry
  if (response.status === 401) {
    // Avoid infinite redirect if the login request itself returns 401
    if (!endpoint.includes('/auth/login')) {
      clearAuthSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('auth:unauthorized', {
            detail: {
              title: 'Sesi Berakhir',
              message: 'Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.',
            },
          })
        );
      }
    }
    throw new ApiError(
      'Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.',
      401,
      'UNAUTHORIZED'
    );
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    // 500+ Server error sanitization: do not leak internal stack traces, DB errors, or file paths
    if (response.status >= 500) {
      const serverMsg =
        response.status === 503
          ? 'Layanan sedang tidak dapat dihubungi. Periksa koneksi Anda atau coba kembali beberapa saat lagi.'
          : 'Terjadi kesalahan saat memproses permintaan. Silakan coba kembali beberapa saat lagi.';
      throw new ApiError(serverMsg, response.status, `SERVER_ERROR_${response.status}`);
    }

    // 4xx Contextual client error (e.g. 400 validation, 403 forbidden, 404 not found)
    const errorMsg =
      json?.error?.message ||
      (typeof json?.detail === 'object' ? json?.detail?.message : json?.detail) ||
      json?.message ||
      `HTTP Error ${response.status}`;
    throw new ApiError(errorMsg, response.status, json?.error?.code, json?.detail);
  }

  return json as T;
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const res = await requestApi<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (res.success && res.data?.token) {
    setAuthToken(res.data.token);
    setAuthUser(res.data.user);
  }

  return res;
}

export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const res = await requestApi<{ success: boolean; message?: string }>('/api/v1/auth/verify-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  return res.success;
}
