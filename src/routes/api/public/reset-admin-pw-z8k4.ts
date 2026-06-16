import { createFileRoute } from "@tanstack/react-router";

// One-shot admin password reset endpoint. DELETE THIS FILE after use.
export const Route = createFileRoute("/api/public/reset-admin-pw-z8k4")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const userId = "ba56da88-0082-4492-91bf-80d1d4e7781d"; // admin@confluxe.local
        const newPassword = "Admin!Reset-2026";
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return Response.json({ ok: true, email: "admin@confluxe.local", password: newPassword });
      },
    },
  },
});
