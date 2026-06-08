import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '@store/useAuthStore';
import { showToast } from '@store/useToastStore';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Si es true, el interceptor no muestra toast de error (lo maneja el caller). */
    skipErrorToast?: boolean;
  }
}

interface NormalizedError {
  message: string;
  status?: number;
}

const normalizeError = (error: AxiosError): NormalizedError => {
  if (error.response) {
    const d = error.response.data as {
      message?: string;
      statusMessage?: string;
      data?: string | { message?: string };
    };
    const nested =
      typeof d?.data === 'string' ? d.data : d?.data && typeof d.data === 'object' ? d.data.message : undefined;
    const base = d?.message || d?.statusMessage || `Error ${error.response.status}`;
    return { message: nested ? `${base} — ${nested}` : base, status: error.response.status };
  }
  if (error.request) return { message: 'Sin conexión con el servidor. Verificá tu internet.' };
  return { message: error.message || 'Error desconocido' };
};

let instance: AxiosInstance | null = null;

const createInstance = (): AxiosInstance => {
  const { apiBaseUrl } = useAuthStore.getState();
  const inst = axios.create({
    baseURL: apiBaseUrl ?? '',
    timeout: 20_000,
    headers: { 'Content-Type': 'application/json' },
  });

  inst.interceptors.request.use((config) => {
    const { token, apiBaseUrl: base } = useAuthStore.getState();
    if (base) config.baseURL = base;
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });

  inst.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
      const norm = normalizeError(error);
      // 401 → cerrar sesión
      if (norm.status === 401) {
        useAuthStore.getState().logout();
      }
      if (!error.config?.skipErrorToast) {
        showToast({ message: norm.message, variant: 'error' });
      }
      return Promise.reject({ ...norm, raw: error });
    },
  );

  return inst;
};

/** Instancia axios (se recrea si cambia la baseURL). */
export const api = new Proxy({} as AxiosInstance, {
  get(_t, prop) {
    if (!instance) instance = createInstance();
    return (instance as any)[prop];
  },
});

/** Forzar recreación (p.ej. al cambiar de entorno). */
export const resetApiClient = () => {
  instance = null;
};
