import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { secureAuthStorage } from "./secureAuthStorage";

export const TRACKING_TASK = "comandpos-delivery-active-trip";
async function sendPosition(position: Location.LocationObject) {
  const raw = await secureAuthStorage.getItem("comandpos-delivery-auth");
  if (!raw) return;
  const auth = JSON.parse(raw).state;
  if (!auth?.token || !auth?.user?.use_id) return;
  const scope = JSON.stringify([
    auth.apiBaseUrl,
    auth.user.use_id,
    auth.locationId,
  ]);
  const preferences = JSON.parse(
    (await AsyncStorage.getItem("delivery-preferences")) || "{}",
  );
  if (!preferences.state?.tracking?.[scope]) return;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await fetch(
      `${auth.apiBaseUrl}/api/restaurant/delivery/position`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_meters: position.coords.accuracy,
          recorded_at: new Date(position.timestamp).toISOString(),
        }),
      },
    );
    if ([401, 403, 409].includes(result.status)) await stopLocationSharing();
  } finally {
    clearTimeout(timer);
  }
}
if (Platform.OS !== "web" && !TaskManager.isTaskDefined(TRACKING_TASK))
  TaskManager.defineTask(TRACKING_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const positions = (data as { locations: Location.LocationObject[] })
      .locations;
    const last = positions?.[positions.length - 1];
    if (last) await sendPosition(last).catch(() => {});
  });
let watcher: Location.LocationSubscription | null = null;
export async function stopLocationSharing() {
  watcher?.remove();
  watcher = null;
  if (
    Platform.OS !== "web" &&
    (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK).catch(
      () => false,
    ))
  )
    await Location.stopLocationUpdatesAsync(TRACKING_TASK).catch(() => {});
}
export async function startLocationSharing(isCurrent: () => boolean) {
  if (Platform.OS === "web") return;
  if (!(await Location.getForegroundPermissionsAsync()).granted || !isCurrent())
    return;
  const background = await Location.getBackgroundPermissionsAsync();
  if (!isCurrent()) return;
  if (background.granted) {
    if (
      !(await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK)) &&
      isCurrent()
    ) {
      await Location.startLocationUpdatesAsync(TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 100,
        timeInterval: 30000,
        deferredUpdatesInterval: 30000,
        pausesUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "ComandPOS · Viaje activo",
          notificationBody:
            "Compartiendo ubicación con despacho durante tus entregas.",
          killServiceOnDestroy: true,
        },
      });
      if (!isCurrent()) await stopLocationSharing();
    }
  } else if (!watcher) {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 100,
        timeInterval: 30000,
      },
      (p) => {
        if (isCurrent()) void sendPosition(p).catch(() => {});
      },
    );
    if (isCurrent()) watcher = subscription;
    else subscription.remove();
  }
}
