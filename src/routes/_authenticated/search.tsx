import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { searchAll } from "@/lib/wiki.functions";
import { Input } from "@/components/ui/input";
import { FileText, BookOpen, Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — Confluxe" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const fn = useServerFn(searchAll);
  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => fn({ data: { q } }),
    enabled: q.trim().length > 0,
  });

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-12">
          <h1 className="text-3xl font-bold tracking-tight">Search</h1>
          <div className="relative mt-6">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages and spaces…" className="pl-9 h-12 text-base" />
          </div>

          {q && (
            <div className="mt-8 space-y-6">
              {isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}
              {data && data.spaces.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Spaces</h3>
                  <div className="space-y-1">
                    {data.spaces.map((s) => (
                      <Link key={s.id} to="/spaces/$spaceId" params={{ spaceId: s.id }} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 hover:bg-accent/50">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-auto text-xs font-mono text-muted-foreground">{s.key}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {data && data.pages.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pages</h3>
                  <div className="space-y-1">
                    {data.pages.map((p) => (
                      <Link key={p.id} to="/spaces/$spaceId/pages/$pageId" params={{ spaceId: p.space_id, pageId: p.id }} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 hover:bg-accent/50">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{p.title || "Untitled"}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {data && data.pages.length === 0 && data.spaces.length === 0 && !isFetching && (
                <p className="text-sm text-muted-foreground">No results for "{q}"</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
