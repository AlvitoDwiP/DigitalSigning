import { requestApi } from './api';
import type { UsersApiResponse, UsersQueryParams, DeleteUserApiResponse } from '../types/users';

export async function fetchUsers(params: UsersQueryParams = {}): Promise<UsersApiResponse> {
  const query = new URLSearchParams();

  if (params.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params.role && params.role.trim()) {
    query.set('role', params.role.trim());
  }
  if (params.status && params.status.trim()) {
    query.set('status', params.status.trim());
  }
  if (params.certificate_status && params.certificate_status.trim()) {
    query.set('certificate_status', params.certificate_status.trim());
  }
  if (params.sort && params.sort.trim()) {
    query.set('sort', params.sort.trim());
  }
  if (params.order) {
    query.set('order', params.order);
  }
  if (params.page !== undefined && params.page > 0) {
    query.set('page', String(params.page));
  }
  if (params.limit !== undefined && params.limit > 0) {
    query.set('limit', String(params.limit));
  }

  const queryString = query.toString();
  const endpoint = queryString ? `/api/v1/users/?${queryString}` : '/api/v1/users/';

  return requestApi<UsersApiResponse>(endpoint, {
    method: 'GET',
  });
}

export async function deleteUser(userId: string): Promise<DeleteUserApiResponse> {
  return requestApi<DeleteUserApiResponse>(`/api/v1/users/${userId}`, {
    method: 'DELETE',
  });
}
