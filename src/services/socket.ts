import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@store/useAuthStore';

let socket: Socket | null = null;
type Handler = (payload: any) => void;
const handlers = new Set<Handler>();

/** Conecta el socket y se une al room personal del rider (user_<use_id>). */
export const connectRiderSocket = (): Socket | null => {
  const { apiBaseUrl, user } = useAuthStore.getState();
  if (!apiBaseUrl || !user?.use_id) return null;
  if (socket?.connected) return socket;
  if (socket) socket.connect();
  else {
    socket = io(apiBaseUrl, {
      path: '/socket.io/',
      transports: ['websocket'],
      reconnectionAttempts: 999,
      reconnectionDelay: 2000,
    });
    socket.on('connect', () => {
      socket?.emit('join_user', { user_id: user.use_id });
    });
    socket.on('rider_order_update', (payload: any) => {
      handlers.forEach((h) => h(payload));
    });
  }
  return socket;
};

/** Suscribe a eventos rider_order_update. Devuelve función de limpieza. */
export const onRiderUpdate = (h: Handler): (() => void) => {
  handlers.add(h);
  return () => {
    handlers.delete(h);
  };
};

export const disconnectRiderSocket = () => {
  socket?.disconnect();
  socket = null;
  handlers.clear();
};
