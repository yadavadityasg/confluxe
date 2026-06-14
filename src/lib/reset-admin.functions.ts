import { createServerFn } from "@tanstack/react-start";

export const resetAdminPw = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      "ba56da88-0082-4492-91bf-80d1d4e7781d",
      { password: "ChangeMe!2026" }
    );
    if (error) throw new Error(error.message);
    return { ok: true, password: "ChangeMe!2026" };
  });