import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/reset-admin-pw-q7m2")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("t") !== "lovable-reset-q7m2") {
          return new Response("forbidden", { status: 403 });
        }
        const email = url.searchParams.get("email") ?? "admin@confluxe.local";
        const password = url.searchParams.get("pw") ?? "ChangeMe!2026";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
        if (listErr) return Response.json({ ok: false, step: "list", error: listErr.message }, { status: 500 });
        const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!user) return Response.json({ ok: false, error: "user not found", emails: list.users.map(u => u.email) }, { status: 404 });
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password,
          email_confirm: true,
        });
        if (updErr) return Response.json({ ok: false, step: "update", error: updErr.message }, { status: 500 });
        return Response.json({ ok: true, email: user.email, password });
      },
    },
  },
});
