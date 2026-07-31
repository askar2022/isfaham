const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export function requireApiUrl() {
  if (!configuredApiUrl) {
    throw new Error("The app is not connected to Isfaham.");
  }

  const parsed = new URL(configuredApiUrl);
  if (!__DEV__ && parsed.protocol !== "https:") {
    throw new Error("The production API must use a secure HTTPS connection.");
  }
  return configuredApiUrl;
}
