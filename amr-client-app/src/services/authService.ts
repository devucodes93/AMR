import { apiRequest } from './api/client';

export type AuthResponse = {
  user: {
    id: string;
    email?: string;
  } | null;
  session: {
    access_token: string;
    refresh_token: string;
  } | null;
};

export async function loginWithBackend(email: string, password: string) {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerWithBackend(
  fullName: string,
  email: string,
  password: string,
  role: 'doctor' | 'pharmacy' | 'medical' = 'medical',
) {
  return apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password, role }),
  });
}
