import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import type { StateStorage } from "zustand/middleware";

let writes: Promise<void> = Promise.resolve();
let sequence = 0;
const directory = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}delivery-sync/`
  : null;
const isQueueFile = (uri: unknown): uri is string =>
  typeof uri === "string" &&
  !!directory &&
  uri.startsWith(directory) &&
  !uri.slice(directory.length).includes("/");
/** Commit a complete snapshot before switching the small pointer. A photo never fills a SQLite row. */
export const queueStorage: StateStorage = {
  async getItem(name) {
    await writes;
    const raw = await AsyncStorage.getItem(name);
    if (!raw) return null;
    const pointer = JSON.parse(raw);
    if (pointer.queue_file) {
      if (!isQueueFile(pointer.queue_file))
        throw new Error("Almacenamiento de sincronización inválido");
      return FileSystem.readAsStringAsync(pointer.queue_file);
    }
    return raw; // Existing AsyncStorage queues migrate on the next write.
  },
  setItem(name, value) {
    const task = writes
      .catch(() => {})
      .then(async () => {
        if (Platform.OS === "web" || !directory) {
          await AsyncStorage.setItem(name, value);
          return;
        }
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        const previous = JSON.parse((await AsyncStorage.getItem(name)) || "{}");
        const uri = `${directory}${Date.now()}-${sequence++}.json`;
        await FileSystem.writeAsStringAsync(uri, value);
        await AsyncStorage.setItem(name, JSON.stringify({ queue_file: uri }));
        if (isQueueFile(previous.queue_file))
          await FileSystem.deleteAsync(previous.queue_file, {
            idempotent: true,
          }).catch(() => {});
      });
    writes = task;
    void task.catch(() => {});
    return task;
  },
  removeItem(name) {
    const task = writes
      .catch(() => {})
      .then(async () => {
        const previous = JSON.parse((await AsyncStorage.getItem(name)) || "{}");
        await AsyncStorage.removeItem(name);
        if (isQueueFile(previous.queue_file))
          await FileSystem.deleteAsync(previous.queue_file, {
            idempotent: true,
          }).catch(() => {});
      });
    writes = task;
    void task.catch(() => {});
    return task;
  },
};
export const flushQueueStorage = () => writes;
