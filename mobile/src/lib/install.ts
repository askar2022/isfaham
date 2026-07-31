import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const INSTALL_ID_KEY = "isfaham-install-id";
let memoryInstallId: string | null = null;

function createInstallId() {
  return `${Date.now().toString(36)}-${Array.from({ length: 4 }, () =>
    Math.random().toString(36).slice(2),
  ).join("")}`;
}

export async function getInstallId() {
  if (memoryInstallId) return memoryInstallId;

  if (Platform.OS === "web") {
    const existing = window.localStorage.getItem(INSTALL_ID_KEY);
    if (existing) return existing;
    const created = createInstallId();
    window.localStorage.setItem(INSTALL_ID_KEY, created);
    memoryInstallId = created;
    return created;
  }

  const existing = await SecureStore.getItemAsync(INSTALL_ID_KEY);
  if (existing) {
    memoryInstallId = existing;
    return existing;
  }

  const created = createInstallId();
  await SecureStore.setItemAsync(INSTALL_ID_KEY, created, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  memoryInstallId = created;
  return created;
}
