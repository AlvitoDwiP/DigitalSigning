import { requestApi } from './api';
import type { DashboardApiResponse, DashboardAdminData } from '../types/dashboard';

export async function fetchAdminDashboard(): Promise<DashboardAdminData> {
  const res = await requestApi<DashboardApiResponse>('/api/v1/dashboard/');
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Gagal mengambil data dashboard');
  }
  return res.data;
}
