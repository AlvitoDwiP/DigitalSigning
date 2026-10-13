export interface AuditLogItem {
  id: string;
  user_id: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name?: string | null;
  status: 'SUCCESS' | 'FAILED' | string;
  created_at: string;
}

export interface AuditLogsPaginationData {
  page: number;
  limit: number;
  total: number;
}

export interface AuditLogsResponseData {
  items: AuditLogItem[];
  pagination: AuditLogsPaginationData;
}

export interface AuditLogsApiResponse {
  success: boolean;
  data: AuditLogsResponseData;
  detail?: string | { code?: string; message?: string };
  message?: string;
}

export interface AuditLogsQueryParams {
  search?: string;
  user_id?: string;
  action?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

