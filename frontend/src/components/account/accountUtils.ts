/**
 * Helper utilities for account components
 */

export function extractErrorMessage(res: any, fallback: string): string {
  if (!res) return fallback;
  if (typeof res.detail === 'string') return res.detail;
  if (res.detail?.message && typeof res.detail.message === 'string') return res.detail.message;
  if (typeof res.message === 'string' && res.message) return res.message;
  return fallback;
}
