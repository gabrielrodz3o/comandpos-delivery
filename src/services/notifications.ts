import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Registra el Expo push token del dispositivo en el backend. */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('delivery', {
      name: 'Entregas',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F97316',
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

  let token: string | null = null;
  try {
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    token = res.data;
  } catch {
    return null;
  }

  if (token) {
    try {
      await api.post('/api/users/push-token', { token, platform: Platform.OS, enabled: true }, { skipErrorToast: true });
    } catch {
      // best-effort
    }
  }
  return token;
};

export const unregisterPushToken = async (token?: string) => {
  try {
    await api.delete('/api/users/push-token', { data: token ? { token } : {}, skipErrorToast: true });
  } catch {
    // best-effort
  }
};
