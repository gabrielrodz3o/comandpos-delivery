import { api } from './apiClient';
import type { AuthUser } from '@types/business';

export interface LoginPayload {
  username: string;
  password: string;
  location_id?: number;
}
export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  const { data } = await api.post<LoginResponse>('/auth/login', {
    username: payload.username,
    password: payload.password,
    rememberMe: true,
    location_id: payload.location_id,
  });
  return data;
};

export const me = async (): Promise<AuthUser> => {
  const { data } = await api.get<{ user: AuthUser } | AuthUser>('/auth/me');
  return (data as { user?: AuthUser }).user ?? (data as AuthUser);
};

export const logoutRequest = async (): Promise<void> => {
  try {
    await api.post('/auth/logout', {}, { skipErrorToast: true });
  } catch {
    // best-effort
  }
};
