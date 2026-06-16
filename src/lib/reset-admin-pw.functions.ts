import { createServerFn } from "@tanstack/react-start";

// One-shot admin password reset. DELETE THIS FILE after use.
export const resetAdminPw = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const userId = "ba56da88-0082-4492-91bf-80d1d4e7781d"; // admin@confluxe.local
  const newPassword = "Admin!Reset-2026";
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) throw new Error(error.message);
  return { ok: true, password: newPassword };
});
