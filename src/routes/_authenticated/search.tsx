import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { searchAll, type ContentMatch } from "@/lib/wiki.functions";
import { Input } from "@/components/ui/input";
import { FileText, BookOpen, Search as SearchIcon, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — Confluxe" }] }),
  component: SearchPage,
});

function Snippet({ m }: { m: ContentMatch }) {
  if (!m.snippet || m.matchStart < 0) return null;
  const before = m.snippet.slice(0, m.matchStart);
  const hit = m.snippet.slice(m.matchStart, m.matchStart + m.matchLen);
  const after = m.snippet.slice(m.matchStart + m.matchLen);
  return (
    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
      {before}
      <mark className="bg-primary/20 text-foreground rounded px-0.5">{hit}</mark>
      {after}
    </p>
  );
}

function PageRow({ m }: { m: ContentMatch }) {
  return (
    <Link
      to="/spaces/$spaceId/pages/$pageId"
      params={{ spaceId: m.space_id, pageId: m.id }}
      className="block rounded-md border border-border bg-card px-3 py-2.5 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{m.space_icon}</span>
        <span className="font-medium">{m.space_name}</span>
        {m.parent_titles.map((t, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3" />
            <span>{t}</span>
          </span>
        ))}
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium flex-1 truncate">{m.title}</span>
        {m.count > 0 && (
          <span className="text-xs font-mono rounded-full bg-primary/10 text-primary px-2 py-0.5">
            {m.count} {m.count === 1 ? "match" : "matches"}
          </span>
        )}
      </div>
      <Snippet m={m} />
    </Link>
  );
}

function SearchPage() {
  const [q, setQ] = useState("");
  const fn = useServerFn(searchAll);
  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => fn({ data: { q } }),
    enabled: q.trim().length > 0,
  });

  const empty = data && data.spaces.length === 0 && data.titlePages.length === 0 && data.contentPages.length === 0;

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-12">
          <h1 className="text-3xl font-bold tracking-tight">Search</h1>
          <div className="relative mt-6">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search spaces, pages, and content…" className="pl-9 h-12 text-base" />
          </div>

          {q && (
            <div className="mt-8 space-y-8">
              {isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}

              {data && data.spaces.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Spaces</h3>
                  <div className="space-y-1">
                    {data.spaces.map((s) => (
                      <Link key={s.id} to="/spaces/$spaceId" params={{ spaceId: s.id }} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 hover:bg-accent/50">
                        <span>{s.icon}</span>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-auto text-xs font-mono text-muted-foreground">{s.key}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data && data.titlePages.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Title matches</h3>
                  <div className="space-y-2">
                    {data.titlePages.map((m) => <PageRow key={m.id} m={m} />)}
                  </div>
                </div>
              )}

              {data && data.contentPages.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">In page content</h3>
                  <div className="space-y-2">
                    {data.contentPages.map((m) => <PageRow key={m.id} m={m} />)}
                  </div>
                </div>
              )}

              {empty && !isFetching && (
                <p className="text-sm text-muted-foreground">No results for "{q}"</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
