export interface AdminItem {
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
}

export interface AdminsResponseData {
  items: AdminItem[];
  total: number;
}

export interface AdminsApiResponse {
  success: boolean;
  data: AdminsResponseData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface AdminCandidatesResponseData {
  items: AdminItem[];
  total: number;
}

export interface AdminCandidatesApiResponse {
  success: boolean;
  data: AdminCandidatesResponseData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface AssignAdminApiResponse {
  success: boolean;
  message?: string;
  data?: AdminItem;
  detail?: string | { code?: string; message?: string };
}

export interface RemoveAdminApiResponse {
  success: boolean;
  message?: string;
  data?: AdminItem;
  detail?: string | { code?: string; message?: string };
}
