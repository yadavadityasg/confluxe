import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapAdmin, checkAdminExists } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const USERNAME_DOMAIN = "wikispace.local";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({ meta: [{ title: "Setup — WikiSpace" }] }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const checkFn = useServerFn(checkAdminExists);
  const bootstrapFn = useServerFn(bootstrapAdmin);

  const { data, isLoading } = useQuery({ queryKey: ["admin-exists"], queryFn: () => checkFn() });

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("Administrator");

  useEffect(() => {
    if (data?.exists) navigate({ to: "/auth", replace: true });
  }, [data, navigate]);

  const m = useMutation({
    mutationFn: () => bootstrapFn({ data: { username: username.trim().toLowerCase(), password, displayName } }),
    onSuccess: async () => {
      toast.success("Admin created");
      const { error } = await supabase.auth.signInWithPassword({
        email: `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`,
        password,
      });
      if (error) {
        navigate({ to: "/auth" });
      } else {
        navigate({ to: "/home" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || data?.exists) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Create the first admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a one-time setup. After this, only the admin can create new users.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
          className="mt-5 space-y-3"
        >
          <div>
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="un">Username</Label>
            <Input id="un" value={username} onChange={(e) => setUsername(e.target.value)} required autoCapitalize="none" />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending || !password || !username}>
            {m.isPending ? "Creating…" : "Create admin & sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
