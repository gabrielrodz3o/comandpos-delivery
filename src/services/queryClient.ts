import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Clave del query de órdenes del rider (compartida por hooks y la cola offline). */
export const MY_ORDERS_KEY = ['my-orders'];

/**
 * Singleton del QueryClient. Vive en un módulo (no en _layout) para que la cola
 * de sincronización pueda parchear el cache de forma optimista sin estar en React.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage });
