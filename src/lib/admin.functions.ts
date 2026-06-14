import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USERNAME_DOMAIN = "wikispace.local";
const usernameSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9_.-]+$/i, "Letters, numbers, dot, dash, underscore only")
  .transform((s) => s.toLowerCase());

function usernameToEmail(u: string) {
  return `${u}@${USERNAME_DOMAIN}`;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

// ---------- BOOTSTRAP (public, but locked once an admin exists) ----------
export const checkAdminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { exists: (count ?? 0) > 0 };
});

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      username: usernameSchema,
      password: z.string().min(6).max(128),
      displayName: z.string().min(1).max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Admin already exists");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName || data.username, username: data.username },
    });
    if (error) throw new Error(error.message);
    if (!created.user) throw new Error("Failed to create user");

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (rErr) throw new Error(rErr.message);

    return { ok: true, username: data.username };
  });

// ---------- ADMIN OPS ----------
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r.role);
    }

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, display_name");
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    return list.users.map((u) => {
      const email = u.email ?? "";
      const username = (u.user_metadata as any)?.username
        ?? (email.endsWith(`@${USERNAME_DOMAIN}`) ? email.slice(0, -`@${USERNAME_DOMAIN}`.length) : email);
      return {
        id: u.id,
        username,
        display_name: nameMap.get(u.id) ?? username,
        is_admin: (roleMap.get(u.id) ?? []).includes("admin"),
        created_at: u.created_at,
      };
    });
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      username: usernameSchema,
      password: z.string().min(6).max(128),
      displayName: z.string().min(1).max(80).optional(),
      makeAdmin: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName || data.username, username: data.username },
    });
    if (error) throw new Error(error.message);
    if (!created.user) throw new Error("Failed to create user");

    if (data.makeAdmin) {
      await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    }
    return { id: created.user.id, username: data.username };
  });

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), password: z.string().min(6).max(128) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetGlobalAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("You cannot remove your own admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- SPACE MEMBERSHIP ----------
export const adminListSpaceMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ spaceId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members, error } = await supabaseAdmin
      .from("space_members")
      .select("id, user_id, role, created_at")
      .eq("space_id", data.spaceId);
    if (error) throw new Error(error.message);
    return members ?? [];
  });

export const adminSetSpaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      spaceId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(["viewer", "editor", "admin"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("space_members")
      .upsert(
        { space_id: data.spaceId, user_id: data.userId, role: data.role },
        { onConflict: "space_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveSpaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ spaceId: z.string().uuid(), userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("space_members")
      .delete()
      .eq("space_id", data.spaceId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CURRENT-USER ROLE INFO ----------
export const getMyRoleInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return {
      userId: context.userId as string | null,
      isAdmin: (roles ?? []).some((r: any) => r.role === "admin"),
    };
  });
