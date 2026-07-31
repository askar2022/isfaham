import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SECURE_CHUNK_SIZE = 1_800;

type SessionStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const secureSessionStorage: SessionStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);

    const chunkCount = Number(
      await SecureStore.getItemAsync(`${key}.chunk-count`),
    );
    if (Number.isInteger(chunkCount) && chunkCount > 0) {
      const chunks = await Promise.all(
        Array.from({ length: chunkCount }, (_, index) =>
          SecureStore.getItemAsync(`${key}.chunk-${index}`),
        ),
      );
      if (chunks.every((chunk): chunk is string => chunk !== null)) {
        return chunks.join("");
      }
    }

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue) {
      await secureSessionStorage.setItem(key, legacyValue);
      await AsyncStorage.removeItem(key);
    }
    return legacyValue;
  },

  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }

    const previousCount = Number(
      await SecureStore.getItemAsync(`${key}.chunk-count`),
    );
    const chunks = value.match(
      new RegExp(`.{1,${SECURE_CHUNK_SIZE}}`, "gs"),
    ) ?? [""];
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}.chunk-${index}`, chunk, {
          keychainAccessible:
            SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        }),
      ),
    );
    await SecureStore.setItemAsync(
      `${key}.chunk-count`,
      String(chunks.length),
      {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      },
    );

    if (Number.isInteger(previousCount) && previousCount > chunks.length) {
      await Promise.all(
        Array.from(
          { length: previousCount - chunks.length },
          (_, offset) =>
            SecureStore.deleteItemAsync(
              `${key}.chunk-${chunks.length + offset}`,
            ),
        ),
      );
    }
  },

  async removeItem(key: string) {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }

    const chunkCount = Number(
      await SecureStore.getItemAsync(`${key}.chunk-count`),
    );
    if (Number.isInteger(chunkCount) && chunkCount > 0) {
      await Promise.all(
        Array.from({ length: chunkCount }, (_, index) =>
          SecureStore.deleteItemAsync(`${key}.chunk-${index}`),
        ),
      );
    }
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}.chunk-count`),
      AsyncStorage.removeItem(key),
    ]);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secureSupabaseUrl =
  supabaseUrl &&
  (__DEV__ || new URL(supabaseUrl).protocol === "https:")
    ? supabaseUrl
    : null;

export const supabase = secureSupabaseUrl && supabasePublishableKey
  ? createClient(secureSupabaseUrl, supabasePublishableKey, {
      auth: {
        storage: secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
