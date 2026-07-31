import { createClient, type User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireEnabledUser(user: User | null) {
  if (!user) return null;
  if (
    user.banned_until &&
    new Date(user.banned_until).getTime() > Date.now()
  ) {
    return null;
  }

  const { data, error } = await createAdminClient()
    .from("user_access_blocks")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("User access check failed:", { code: error.code });
    return null;
  }
  return data ? null : user;
}

export async function getRequestUser(
  request: Request,
  options: { allowBlocked?: boolean } = {},
): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (accessToken) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !publishableKey) return null;

    const supabase = createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser(accessToken);
    return options.allowBlocked ? user : requireEnabledUser(user);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return options.allowBlocked ? user : requireEnabledUser(user);
  } catch {
    return null;
  }
}
