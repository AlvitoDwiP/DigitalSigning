export interface UserCertificate {
  id: string;
  serial_number: string;
  subject: string;
  issuer: string;
  fingerprint_sha256: string;
  issued_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REPLACED' | 'REVOKED' | string;
}

export interface UserItem {
  id: string;
  name: string;
  nik: string;
  email: string;
  organization: string | null;
  ou: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER' | string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  created_at: string;
  updated_at?: string;
  active_certificate: UserCertificate | null;
}

export interface UsersPaginationData {
  page: number;
  limit: number;
  total: number;
}

export interface UsersResponseData {
  items: UserItem[];
  pagination: UsersPaginationData;
}

export interface UsersApiResponse {
  success: boolean;
  data: UsersResponseData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface UsersQueryParams {
  search?: string;
  role?: string;
  status?: string;
  certificate_status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface DeleteUserApiResponse {
  success: boolean;
  message?: string;
  detail?: string | { code?: string; message?: string };
}
