import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { checkAdminExists } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const USERNAME_DOMAIN = "wikispace.local";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — WikiSpace" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const checkFn = useServerFn(checkAdminExists);
  const { data: adminInfo } = useQuery({
    queryKey: ["admin-exists"],
    queryFn: () => checkFn(),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const cleaned = username.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: `${cleaned}@${USERNAME_DOMAIN}`,
      password,
    });
    setLoading(false);
    if (error) return toast.error("Invalid username or password");
    navigate({ to: "/home" });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground font-bold">C</div>
          <div>
            <div className="font-semibold">WikiSpace</div>
            <div className="text-xs text-muted-foreground">Sign in to continue</div>
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {adminInfo && !adminInfo.exists && (
          <div className="mt-6 rounded-md border border-dashed border-border p-3 text-center text-sm">
            <p className="text-muted-foreground">No admin account yet.</p>
            <Link to="/setup" className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
              Create the first admin →
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are created by your administrator.
        </p>
      </div>
    </div>
  );
}
