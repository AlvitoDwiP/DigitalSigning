export interface UserCertificate {
  id: string;
  serial_number: string;
  certificate_number?: string;
  subject: string;
  issuer: string;
  fingerprint_sha256: string;
  issued_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REPLACED' | string;
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

export interface UserDetailData extends UserItem {
  certificate_history?: UserCertificate[];
}

export interface UserDetailApiResponse {
  success: boolean;
  data: UserDetailData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface RegenerateCertificateResponseData {
  old_certificate_id: string;
  new_certificate: {
    id: string;
    serial_number: string;
    issued_at: string;
    expires_at: string;
    status: string;
  };
}

export interface RegenerateCertificatePayload {
  admin_password?: string;
  password?: string;
  pfx_password?: string;
  confirm_pfx_password?: string;
}

export interface RegenerateCertificateApiResponse {
  success: boolean;
  data: RegenerateCertificateResponseData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface ChangePfxPasswordRequest {
  new_password: string;
  confirm_password: string;
  old_password?: string;
}

export interface ChangePfxPasswordApiResponse {
  success: boolean;
  message?: string;
  detail?: string | { code?: string; message?: string };
}

export interface DeleteUserApiResponse {
  success: boolean;
  message?: string;
  detail?: string | { code?: string; message?: string };
}

export interface GenerateUserPayload {
  name: string;
  nik: string;
  email: string;
  organization: string;
  ou: string;
  password: string;
  pfx_password?: string;
  confirm_pfx_password?: string;
}

export interface GenerateUserData {
  user: UserItem;
  certificate: UserCertificate;
}

export interface GenerateUserApiResponse {
  success: boolean;
  data: GenerateUserData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface BulkPreviewRow {
  row: number;
  nik: string;
  name?: string;
  email?: string;
  organization?: string;
  ou?: string;
  valid: boolean;
  errors?: string[];
}

export interface BulkValidationData {
  total: number;
  valid: number;
  invalid: number;
  rows: BulkPreviewRow[];
}

export interface BulkValidationApiResponse {
  success: boolean;
  data: BulkValidationData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface BulkResultItem {
  row: number;
  nik: string;
  name?: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

export interface BulkGenerateData {
  total: number;
  success: number;
  failed: number;
  results: BulkResultItem[];
}

export interface BulkGenerateApiResponse {
  success: boolean;
  data: BulkGenerateData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}




