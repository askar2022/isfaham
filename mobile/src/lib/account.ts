import { fetch } from "expo/fetch";

import { requireApiUrl } from "./config";

export async function deleteAccount(accessToken: string) {
  const response = await fetch(`${requireApiUrl()}/api/account`, {
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
