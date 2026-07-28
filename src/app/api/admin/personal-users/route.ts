import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getPlatformAdminContext } from "@/lib/platform-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function listAllUsers(admin: SupabaseClient) {
  const users: User[] = [];
  let page = 1;

  while (page <= 100) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function getProfileIds(admin: SupabaseClient, userIds: string[]) {
  const profileIds = new Set<string>();
  if (!userIds.length) return profileIds;
  for (let index = 0; index < userIds.length; index += 200) {
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .in("id", userIds.slice(index, index + 200));
    if (error) throw error;
    for (const profile of data ?? []) profileIds.add(profile.id);
  }
  return profileIds;
}

async function getWallets(admin: SupabaseClient, userIds: string[]) {
  const wallets = new Map<
    string,
    {
      balance_seconds: number;
      purchased_seconds: number;
      used_seconds: number;
    }
  >();
  if (!userIds.length) return wallets;
  for (let index = 0; index < userIds.length; index += 200) {
    const { data, error } = await admin
      .from("credit_wallets")
      .select("user_id, balance_seconds, purchased_seconds, used_seconds")
      .in("user_id", userIds.slice(index, index + 200));
    if (error) throw error;
    for (const wallet of data ?? []) wallets.set(wallet.user_id, wallet);
  }
  return wallets;
}

async function requirePersonalUser(admin: SupabaseClient, userId: string) {
  if (!UUID_PATTERN.test(userId)) return null;

  const [{ data, error }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("id").eq("id", userId).maybeSingle(),
  ]);

  if (error || !data.user || data.user.is_anonymous || profile) return null;
  const email = data.user.email?.trim().toLowerCase();
  if (email) {
    const [{ data: platformAdmin }, { data: approvedTeacher }] =
      await Promise.all([
        admin
          .from("platform_administrators")
          .select("email")
          .eq("email", email)
          .maybeSingle(),
        admin
          .from("approved_teachers")
          .select("email")
          .eq("email", email)
          .maybeSingle(),
      ]);
    if (platformAdmin || approvedTeacher) return null;
  }
  return data.user;
}

export async function GET(request: Request) {
  try {
    const context = await getPlatformAdminContext();
    if (!context) {
      return NextResponse.json(
        { error: "Platform administrator access required." },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(10, Number(url.searchParams.get("perPage")) || 50),
    );

    const allUsers = await listAllUsers(context.admin);
    const [profileIds, platformAdminResult, approvedTeacherResult] =
      await Promise.all([
      getProfileIds(
        context.admin,
        allUsers.map((user) => user.id),
      ),
      context.admin.from("platform_administrators").select("email"),
      context.admin.from("approved_teachers").select("email"),
    ]);
    if (platformAdminResult.error) throw platformAdminResult.error;
    if (approvedTeacherResult.error) throw approvedTeacherResult.error;
    const platformAdmins = platformAdminResult.data;
    const platformEmails = new Set(
      (platformAdmins ?? []).map((admin) => admin.email.toLowerCase()),
    );
    const approvedTeacherEmails = new Set(
      (approvedTeacherResult.data ?? []).map((teacher) =>
        teacher.email.toLowerCase(),
      ),
    );
    const guests = allUsers.filter((user) => user.is_anonymous);
    const personalUsers = allUsers
      .filter(
        (user) =>
          !user.is_anonymous &&
          !profileIds.has(user.id) &&
          !platformEmails.has(user.email?.toLowerCase() ?? "") &&
          !approvedTeacherEmails.has(user.email?.toLowerCase() ?? ""),
      )
      .filter((user) => !search || user.email?.toLowerCase().includes(search))
      .sort(
        (first, second) =>
          new Date(second.created_at).getTime() -
          new Date(first.created_at).getTime(),
      );

    const start = (page - 1) * perPage;
    const selectedUsers = personalUsers.slice(start, start + perPage);
    const wallets = await getWallets(
      context.admin,
      selectedUsers.map((user) => user.id),
    );
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    return NextResponse.json(
      {
        users: selectedUsers.map((user) => {
          const wallet = wallets.get(user.id);
          return {
            id: user.id,
            email: user.email ?? "Email unavailable",
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at ?? null,
            disabled:
              Boolean(user.banned_until) &&
              new Date(user.banned_until!).getTime() > now,
            balanceSeconds: Number(wallet?.balance_seconds ?? 0),
            purchasedSeconds: Number(wallet?.purchased_seconds ?? 0),
            usedSeconds: Number(wallet?.used_seconds ?? 0),
          };
        }),
        pagination: {
          page,
          perPage,
          total: personalUsers.length,
          totalPages: Math.max(1, Math.ceil(personalUsers.length / perPage)),
        },
        overview: {
          personalUsers: allUsers.filter(
            (user) =>
              !user.is_anonymous &&
              !profileIds.has(user.id) &&
              !platformEmails.has(user.email?.toLowerCase() ?? "") &&
              !approvedTeacherEmails.has(user.email?.toLowerCase() ?? ""),
          ).length,
          schoolStaff: profileIds.size,
          guestTrials: guests.length,
          guestTrialsLast30Days: guests.filter(
            (user) => new Date(user.created_at).getTime() >= thirtyDaysAgo,
          ).length,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Personal user list failed:", error);
    return NextResponse.json(
      { error: "Personal users could not be loaded." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getPlatformAdminContext();
    if (!context) {
      return NextResponse.json(
        { error: "Platform administrator access required." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      userId?: string;
      disabled?: boolean;
    };
    if (!body.userId || typeof body.disabled !== "boolean") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const target = await requirePersonalUser(context.admin, body.userId);
    if (!target) {
      return NextResponse.json(
        { error: "Personal user not found." },
        { status: 404 },
      );
    }

    const { error } = await context.admin.auth.admin.updateUserById(target.id, {
      ban_duration: body.disabled ? "876000h" : "none",
    });
    if (error) throw error;

    return NextResponse.json({ updated: true, disabled: body.disabled });
  } catch (error) {
    console.error("Personal user access update failed:", error);
    return NextResponse.json(
      { error: "Personal user access could not be updated." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getPlatformAdminContext();
    if (!context) {
      return NextResponse.json(
        { error: "Platform administrator access required." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { userId?: string };
    if (!body.userId) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const target = await requirePersonalUser(context.admin, body.userId);
    if (!target) {
      return NextResponse.json(
        { error: "Personal user not found." },
        { status: 404 },
      );
    }

    const { error } = await context.admin.auth.admin.deleteUser(target.id);
    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Personal user deletion failed:", error);
    return NextResponse.json(
      { error: "Personal user could not be deleted." },
      { status: 500 },
    );
  }
}
