import { useMemo } from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@store/useAuthStore';
import { logoutRequest } from '@services/auth';
import { accessibleLocations, type AccessibleLocation } from '@utils/locations';
import { Press } from '@components/ui/Press';
import { IcMapPin, IcChevronRight } from '@components/ui/icons';
import { palette, shadow } from '@theme/colors';

const c = palette.dark;

/** Agrupa las sucursales accesibles por unidad de negocio para mostrarlas. */
function groupByUnit(locs: AccessibleLocation[]) {
  const map = new Map<string, { unit: string; items: AccessibleLocation[] }>();
  for (const l of locs) {
    const key = String(l.businessUnitId ?? '_');
    const unit = l.businessUnitName || 'Mi negocio';
    if (!map.has(key)) map.set(key, { unit, items: [] });
    map.get(key)!.items.push(l);
  }
  return [...map.values()];
}

export default function SelectLocationScreen() {
  const router = useRouter();
  const { user, setLocationId, logout } = useAuthStore();

  const locs = useMemo(() => accessibleLocations(user), [user]);
  const groups = useMemo(() => groupByUnit(locs), [locs]);

  const pick = (id: number) => {
    Haptics.selectionAsync().catch(() => {});
    setLocationId(id);
    router.replace('/(tabs)/orders');
  };

  const onLogout = () => {
    logoutRequest();
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8 }}>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
            ¿Dónde trabajás hoy?
          </Text>
          <Text style={{ color: c.textDim, fontSize: 14, marginTop: 4 }}>
            Elegí tu sucursal para arrancar el día.
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {groups.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: c.textDim, fontSize: 15, textAlign: 'center' }}>
                No tenés sucursales asignadas. Contactá a tu administrador.
              </Text>
            </View>
          )}

          {groups.map((g) => (
            <View key={g.unit} style={{ marginTop: 18 }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 8, marginBottom: 8 }}>
                {g.unit}
              </Text>
              {g.items.map((l) => (
                <Press
                  key={l.id}
                  onPress={() => pick(l.id)}
                  scaleTo={0.97}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: c.surface,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    marginBottom: 10,
                    ...shadow.sm,
                  }}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.primary + '1A', alignItems: 'center', justifyContent: 'center' }}>
                    <IcMapPin size={20} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                      {l.name}
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>Sucursal #{l.id}</Text>
                  </View>
                  <IcChevronRight size={18} color={c.textMuted} />
                </Press>
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <Press onPress={onLogout} haptic={false} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>Cerrar sesión</Text>
          </Press>
        </View>
      </SafeAreaView>
    </View>
  );
}
