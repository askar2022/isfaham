import { createHmac } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  scope: string;
  identifier: string;
  maximumRequests: number;
  windowSeconds: number;
};

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function privateIdentifier(value: string) {
  const secret =
    process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Rate limiting is not configured.");
  }
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function consumeRateLimit({
  scope,
  identifier,
  maximumRequests,
  windowSeconds,
}: RateLimitOptions) {
  const key = `${scope}:${privateIdentifier(identifier)}`;
  const { data, error } = await createAdminClient().rpc(
    "consume_api_rate_limit",
    {
      requested_key: key,
      maximum_requests: maximumRequests,
      window_seconds: windowSeconds,
    },
  );

  if (error) {
    console.error("Rate-limit check failed:", {
      scope,
      code: error.code,
    });
    return false;
  }
  return data === true;
}

export async function claimAnonymousTrialDevice(
  request: Request,
  userId: string,
) {
  const installId = request.headers.get("x-isfaham-install-id")?.trim();
  if (!installId || !/^[a-z0-9-]{16,128}$/i.test(installId)) {
    return process.env.REQUIRE_TRIAL_DEVICE_ID !== "true";
  }

  const { data, error } = await createAdminClient().rpc(
    "claim_trial_device",
    {
      requested_device_hash: privateIdentifier(installId),
      requested_user_id: userId,
    },
  );
  if (error) {
    console.error("Trial device claim failed:", { code: error.code });
    return false;
  }
  return data === true;
}
