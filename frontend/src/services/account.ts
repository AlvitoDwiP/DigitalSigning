import { requestApi } from './api';
import type {
  AccountApiResponse,
  UpdateAccountPayload,
  ChangeAccountLoginPasswordPayload,
  ChangeAccountPfxPasswordPayload,
  AccountActionApiResponse,
} from '../types/account';

export async function fetchAccount(): Promise<AccountApiResponse> {
  return requestApi<AccountApiResponse>('/api/v1/account/', {
    method: 'GET',
  });
}

export async function updateAccount(payload: UpdateAccountPayload): Promise<AccountApiResponse> {
  return requestApi<AccountApiResponse>('/api/v1/account/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function changeAccountLoginPassword(
  payload: ChangeAccountLoginPasswordPayload
): Promise<AccountActionApiResponse> {
  return requestApi<AccountActionApiResponse>('/api/v1/account/password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function changeAccountPfxPassword(
  payload: ChangeAccountPfxPasswordPayload
): Promise<AccountActionApiResponse> {
  return requestApi<AccountActionApiResponse>('/api/v1/account/pfx-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
