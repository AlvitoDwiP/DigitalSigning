import { requestApi } from './api';
import type {
  DashboardApiResponse,
  DashboardAdminData,
  DashboardUserApiResponse,
  DashboardUserData,
} from '../types/dashboard';

export async function fetchAdminDashboard(): Promise<DashboardAdminData> {
  const res = await requestApi<DashboardApiResponse>('/api/v1/dashboard/');
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Gagal mengambil data dashboard');
  }
  return res.data;
}

export async function fetchUserDashboard(): Promise<DashboardUserData> {
  const res = await requestApi<DashboardUserApiResponse>('/api/v1/dashboard/');
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Gagal mengambil data dashboard pengguna');
  }
  return res.data;
}

