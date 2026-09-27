import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { StateStorage } from "zustand/middleware";

const credentialKey = "comandpos.delivery.session";
// Serialize writes so an earlier login can never overwrite a subsequent logout.
let pending = Promise.resolve();
let webToken: string | null = null;
const save = async (token: string | null) => {
  if (Platform.OS === "web") {
    webToken = token;
    return;
  }
  if (token)
    await SecureStore.setItemAsync(credentialKey, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  else await SecureStore.deleteItemAsync(credentialKey);
};
export const secureAuthStorage: StateStorage = {
  async getItem(name) {
    await pending;
    const raw = await AsyncStorage.getItem(name);
    if (!raw) return null;
    const value = JSON.parse(raw);
    // Migrate the previous plaintext credential before removing it from AsyncStorage.
    if (value.state?.token) {
      await save(value.state.token);
      delete value.state.token;
      await AsyncStorage.setItem(name, JSON.stringify(value));
    }
    const token =
      Platform.OS === "web"
        ? webToken
        : await SecureStore.getItemAsync(credentialKey);
    return JSON.stringify({ ...value, state: { ...value.state, token } });
  },
  setItem(name, raw) {
    const value = JSON.parse(raw);
    const token = value.state?.token || null;
    delete value.state.token;
    const write = pending
      .catch(() => {})
      .then(async () => {
        await save(token);
        await AsyncStorage.setItem(name, JSON.stringify(value));
      });
    pending = write;
    return write;
  },
  removeItem(name) {
    const write = pending
      .catch(() => {})
      .then(async () => {
        await save(null);
        await AsyncStorage.removeItem(name);
      });
    pending = write;
    return write;
  },
};
