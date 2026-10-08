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
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage access blocked
  }
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
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
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Storage access blocked
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Storage access blocked
  }
}

export async function requestApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuthSession();
    // Dispatch auth expiration event if needed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = json?.detail || json?.message || `HTTP Error ${response.status}`;
    throw new Error(errorMsg);
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
