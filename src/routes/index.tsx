import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BookOpen, Users, History, MessageSquare, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "WikiSpace — A modern team wiki" },
      { name: "description", content: "Organize knowledge into spaces, write together, and keep your team aligned." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold">C</div>
            <span className="text-lg font-semibold tracking-tight">WikiSpace</span>
          </Link>
          <Link to="/auth" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/40 px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Built for teams that write together
        </div>
        <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight text-foreground">
          Your team's <span className="text-primary">knowledge home</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Organize docs into spaces, draft together with a rich editor, comment, and track every change. The clarity of a great wiki, none of the clutter.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link to="/auth" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors">
            Get started — free
          </Link>
          <a href="#features" className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors">
            See features
          </a>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: BookOpen, title: "Spaces & nested pages", body: "Group docs by team or project. Nest pages as deep as you need." },
            { icon: Sparkles, title: "Rich editor", body: "Headings, lists, quotes, code, links — fast and focused." },
            { icon: MessageSquare, title: "Inline comments", body: "Discuss pages in context. Replies notify with @mentions." },
            { icon: History, title: "Page history", body: "Every edit is snapshotted. Restore anytime." },
            { icon: Search, title: "Instant search", body: "Find any page across all spaces in milliseconds." },
            { icon: Users, title: "Built for collaboration", body: "Anyone on your team can read, write, and comment." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">© WikiSpace</div>
      </footer>
    </div>
  );
}
