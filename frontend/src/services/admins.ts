import { requestApi } from './api';
import type {
  AdminsApiResponse,
  AdminCandidatesApiResponse,
  AssignAdminApiResponse,
  RemoveAdminApiResponse,
} from '../types/admins';

export async function fetchAdmins(): Promise<AdminsApiResponse> {
  return requestApi<AdminsApiResponse>('/api/v1/admins/', {
    method: 'GET',
  });
}

export async function fetchAdminCandidates(): Promise<AdminCandidatesApiResponse> {
  return requestApi<AdminCandidatesApiResponse>('/api/v1/admins/candidates', {
    method: 'GET',
  });
}

export async function assignAdmin(userId: string): Promise<AssignAdminApiResponse> {
  return requestApi<AssignAdminApiResponse>(`/api/v1/admins/${userId}`, {
    method: 'POST',
  });
}

export async function removeAdmin(userId: string): Promise<RemoveAdminApiResponse> {
  return requestApi<RemoveAdminApiResponse>(`/api/v1/admins/${userId}`, {
    method: 'DELETE',
  });
}
