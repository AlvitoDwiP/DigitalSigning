export interface DashboardStatistics {
  total_user: number;
  active: number;
  expired: number;
}

export interface ExpiringCertificateUser {
  user_id: string;
  name: string;
  expires_at: string; // ISO date string
}

export interface ExpiryBuckets {
  within_30_days: number;
  '31_to_60_days': number;
  '61_to_90_days': number;
}

export interface RecentActivity {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  status: 'SUCCESS' | 'FAILED' | string;
  created_at: string; // ISO date string
}

export interface DashboardAdminData {
  statistics: DashboardStatistics;
  expiring_certificates: ExpiringCertificateUser[];
  expiry_buckets: ExpiryBuckets;
  recent_activities: RecentActivity[];
}

export interface DashboardApiResponse {
  success: boolean;
  data: DashboardAdminData;
  detail?: string;
  message?: string;
}

export interface DashboardUserCertificate {
  id: string;
  serial_number: string;
  issued_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REPLACED' | 'REVOKED' | string;
  days_remaining: number;
}

export interface DashboardUserAccount {
  id: string;
  name: string;
  email: string;
  nik: string;
  organization: string;
  ou: string;
}

export interface DashboardUserData {
  user: DashboardUserAccount;
  active_certificate: DashboardUserCertificate | null;
  has_active_certificate: boolean;
}

export interface DashboardUserApiResponse {
  success: boolean;
  data: DashboardUserData;
  detail?: string;
  message?: string;
}

