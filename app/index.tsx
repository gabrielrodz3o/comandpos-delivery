import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@store/useAuthStore';
import { palette } from '@theme/colors';

export default function Index() {
  const { token, locationId, hydrated } = useAuthStore();
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.dark.bg }}>
        <ActivityIndicator color={palette.dark.primary} />
      </View>
    );
  }
  if (!token) return <Redirect href="/(auth)/login" />;
  // Con sesión pero sin sucursal elegida (multi-sucursal) → selector.
  if (locationId == null) return <Redirect href="/select-location" />;
  return <Redirect href="/(tabs)/orders" />;
}
