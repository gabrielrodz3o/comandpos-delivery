import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser } from '@types/business';

// URL del backend Nuxt (restaurante-comandpos). Por defecto apunta a
// producción. En dev, sobreescribir con EXPO_PUBLIC_API_URL apuntando a la
// IP LAN de tu máquina (ej: http://192.168.1.50:3000 — el teléfono NO puede
// usar localhost).
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || undefined;
// Producción. EXPO_PUBLIC_API_URL la sobreescribe (para dev contra LAN).
export const DEFAULT_API_BASE_URL = ENV_API_URL ?? 'https://api.comandpos.com';

interface AuthState {
  apiBaseUrl: string | null;
  token: string | null;
  user: AuthUser | null;
  /** Sucursal (location_id) activa del rider. */
  locationId: number | null;
  hydrated: boolean;
  setApiBaseUrl: (url: string) => void;
  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  setLocationId: (id: number | null) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiBaseUrl: DEFAULT_API_BASE_URL,
      token: null,
      user: null,
      locationId: null,
      hydrated: false,
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      setLocationId: (locationId) => set({ locationId }),
      logout: () => set({ token: null, user: null, locationId: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'comandpos-delivery-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        apiBaseUrl: state.apiBaseUrl,
        token: state.token,
        user: state.user,
        locationId: state.locationId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // No hay selector manual de URL: la base efectiva es siempre ENV o el
          // default de producción. Forzamos para migrar valores persistidos
          // viejos (ej. la IP LAN de dev de una instalación anterior).
          if (state.apiBaseUrl !== DEFAULT_API_BASE_URL) {
            state.setApiBaseUrl(DEFAULT_API_BASE_URL);
          }
        }
        state?.setHydrated();
      },
    },
  ),
);

/** use_id del rider logueado. */
export const currentRiderId = (): number | null =>
  useAuthStore.getState().user?.use_id ?? null;
