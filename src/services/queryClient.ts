import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@store/useAuthStore';

/** Clave del query de órdenes del rider (compartida por hooks y la cola offline). */
export const MY_ORDERS_KEY = ['delivery'];

/**
 * Singleton del QueryClient. Vive en un módulo (no en _layout) para que la cola
 * de sincronización pueda parchear el cache de forma optimista sin estar en React.
 */
export const queryClient = new QueryClient({
  // refetchOnWindowFocus se apoya en focusManager, cableado al AppState en _layout
  // (RN no lo hace solo): al volver la app a primer plano se refresca la verdad del server.
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'delivery-query-v2' });

// Covers explicit logout and token expiry; cancel stale responses before clearing.
useAuthStore.subscribe((state, previous) => {
  // Initial credential hydration must not erase the offline cache being restored.
  if (!previous.hydrated) return;
  if (state.token !== previous.token || state.locationId !== previous.locationId || state.user?.use_id !== previous.user?.use_id || state.apiBaseUrl !== previous.apiBaseUrl) {
    void queryClient.cancelQueries();
    queryClient.clear();
    void persister.removeClient();
  }
});
