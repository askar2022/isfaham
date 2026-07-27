import { fetch } from "expo/fetch";

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export async function deleteAccount(accessToken: string) {
  if (!apiUrl) {
    throw new Error("The app is not connected to Isfaham.");
  }

  const response = await fetch(`${apiUrl}/api/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as {
    deleted?: boolean;
    error?: string;
  };

  if (!response.ok || !body.deleted) {
    throw new Error(body.error || "Your account could not be deleted.");
  }
}
