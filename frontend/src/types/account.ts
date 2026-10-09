export interface AccountData {
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

export interface AccountApiResponse {
  success: boolean;
  data: AccountData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface UpdateAccountPayload {
  name?: string;
  email?: string;
  organization?: string;
  ou?: string;
}

export interface ChangeAccountLoginPasswordPayload {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangeAccountPfxPasswordPayload {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface AccountActionApiResponse {
  success: boolean;
  message?: string;
  data?: AccountData;
  detail?: string | { code?: string; message?: string };
}
