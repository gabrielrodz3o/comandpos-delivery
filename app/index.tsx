import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@store/useAuthStore';
import { palette } from '@theme/colors';

export default function Index() {
  const { token, hydrated } = useAuthStore();
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.dark.bg }}>
        <ActivityIndicator color={palette.dark.primary} />
      </View>
    );
  }
  return <Redirect href={token ? '/(tabs)/orders' : '/(auth)/login'} />;
}
