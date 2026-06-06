import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppSidebar } from "@/components/AppSidebar";
import { getSpace, listPages, createPage } from "@/lib/wiki.functions";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/spaces/$spaceId")({
  component: SpacePage,
});

function SpacePage() {
  const { spaceId } = Route.useParams();
  const getSpaceFn = useServerFn(getSpace);
  const listPagesFn = useServerFn(listPages);
  const createPageFn = useServerFn(createPage);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: space } = useQuery({ queryKey: ["space", spaceId], queryFn: () => getSpaceFn({ data: { id: spaceId } }) });
  const { data: pages = [] } = useQuery({ queryKey: ["pages", spaceId], queryFn: () => listPagesFn({ data: { spaceId } }) });

  const newPage = useMutation({
    mutationFn: () => createPageFn({ data: { spaceId } }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["pages", spaceId] });
      navigate({ to: "/spaces/$spaceId/pages/$pageId", params: { spaceId, pageId: p.id } });
    },
  });

  const roots = pages.filter((p) => !p.parent_id);

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-12">
          {space && (
            <>
              <div className="flex items-start gap-4">
                <div className="text-5xl">{space.icon}</div>
                <div className="flex-1">
                  <div className="text-xs font-mono font-semibold text-muted-foreground">{space.key}</div>
                  <h1 className="text-3xl font-bold tracking-tight">{space.name}</h1>
                  {space.description && <p className="mt-2 text-muted-foreground">{space.description}</p>}
                </div>
                <Button onClick={() => newPage.mutate()}><Plus className="mr-1.5 h-4 w-4" /> New page</Button>
              </div>

              <div className="mt-10">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pages</h2>
                <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                  {roots.map((p) => (
                    <Link key={p.id} to="/spaces/$spaceId/pages/$pageId" params={{ spaceId, pageId: p.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 font-medium">{p.title || "Untitled"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</span>
                    </Link>
                  ))}
                  {roots.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No pages yet. Click "New page" to create one.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
