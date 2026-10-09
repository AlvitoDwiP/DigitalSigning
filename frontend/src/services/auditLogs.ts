import { requestApi } from './api';
import type {
  AuditLogsApiResponse,
  AuditLogsQueryParams,
} from '../types/auditLogs';

export async function fetchAuditLogs(params: AuditLogsQueryParams = {}): Promise<AuditLogsApiResponse> {
  const query = new URLSearchParams();

  if (params.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params.action && params.action.trim()) {
    query.set('action', params.action.trim());
  }
  if (params.status && params.status.trim()) {
    query.set('status', params.status.trim());
  }
  if (params.start_date && params.start_date.trim()) {
    query.set('start_date', params.start_date.trim());
  }
  if (params.end_date && params.end_date.trim()) {
    query.set('end_date', params.end_date.trim());
  }
  if (params.page !== undefined && params.page > 0) {
    query.set('page', String(params.page));
  }
  if (params.limit !== undefined && params.limit > 0) {
    query.set('limit', String(params.limit));
  }

  const queryString = query.toString();
  const endpoint = queryString ? `/api/v1/audit-logs/?${queryString}` : '/api/v1/audit-logs/';

  return requestApi<AuditLogsApiResponse>(endpoint, {
    method: 'GET',
  });
}
