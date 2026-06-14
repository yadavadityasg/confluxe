import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppSidebar } from "@/components/AppSidebar";
import { listSpaces } from "@/lib/wiki.functions";
import { BookOpen, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — WikiSpace" }] }),
  component: HomePage,
});

function HomePage() {
  const fn = useServerFn(listSpaces);
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: () => fn() });

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-12">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back 👋</h1>
          <p className="mt-2 text-muted-foreground">Pick a space to dive in, or create a new one.</p>

          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your spaces</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {spaces.map((s) => (
                <Link key={s.id} to="/spaces/$spaceId" params={{ spaceId: s.id }} className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md">
                  <div className="text-3xl">{s.icon}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">{s.key}</span>
                  </div>
                  <h3 className="mt-2 font-semibold text-foreground group-hover:text-primary transition-colors">{s.name}</h3>
                  {s.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                </Link>
              ))}
              {spaces.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <h3 className="mt-3 font-semibold">No spaces yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Click the <Plus className="inline h-3.5 w-3.5" /> next to "Spaces" in the sidebar to create one.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
