import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { PageEditor } from "@/components/PageEditor";
import { CommentsPanel } from "@/components/CommentsPanel";
import { getPage, updatePage, deletePage, listVersions, listProfiles, createPage } from "@/lib/wiki.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { History, Trash2, Plus, Check, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/spaces/$spaceId/pages/$pageId")({
  component: PageView,
});

function PageView() {
  const { spaceId, pageId } = Route.useParams();
  const getPageFn = useServerFn(getPage);
  const updatePageFn = useServerFn(updatePage);
  const deletePageFn = useServerFn(deletePage);
  const listVersionsFn = useServerFn(listVersions);
  const listProfilesFn = useServerFn(listProfiles);
  const createPageFn = useServerFn(createPage);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: page } = useQuery({
    queryKey: ["page", pageId],
    queryFn: () => getPageFn({ data: { id: pageId } }),
  });
  const { data: versions = [] } = useQuery({
    queryKey: ["versions", pageId],
    queryFn: () => listVersionsFn({ data: { pageId } }),
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: () => listProfilesFn() });
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<unknown>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const initRef = useRef<string | null>(null);

  useEffect(() => {
    if (page && initRef.current !== page.id) {
      setTitle(page.title);
      setContent(page.content);
      initRef.current = page.id;
      setSavedAt(null);
    }
  }, [page]);

  const save = useMutation({
    mutationFn: () => updatePageFn({ data: { id: pageId, title, content } }),
    onSuccess: () => {
      setSavedAt(new Date());
      qc.invalidateQueries({ queryKey: ["pages", spaceId] });
      qc.invalidateQueries({ queryKey: ["versions", pageId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Autosave debounce
  useEffect(() => {
    if (!page || initRef.current !== page.id) return;
    if (title === page.title && JSON.stringify(content) === JSON.stringify(page.content)) return;
    const t = setTimeout(() => save.mutate(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  const del = useMutation({
    mutationFn: () => deletePageFn({ data: { id: pageId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages", spaceId] });
      toast.success("Page deleted");
      navigate({ to: "/spaces/$spaceId", params: { spaceId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const newChild = useMutation({
    mutationFn: () => createPageFn({ data: { spaceId, parentId: pageId } }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["pages", spaceId] });
      navigate({ to: "/spaces/$spaceId/pages/$pageId", params: { spaceId, pageId: p.id } });
    },
  });

  if (!page) return <div className="flex h-screen"><AppSidebar /><main className="flex-1 grid place-items-center text-muted-foreground">Loading…</main></div>;

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-8 py-2.5">
          <div className="flex-1 text-xs text-muted-foreground flex items-center gap-2">
            {save.isPending ? <><Clock className="h-3 w-3" /> Saving…</> :
             savedAt ? <><Check className="h-3 w-3 text-primary" /> Saved {formatDistanceToNow(savedAt, { addSuffix: true })}</> :
             <>Last edited {formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })}</>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => newChild.mutate()}><Plus className="h-4 w-4 mr-1" /> Subpage</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm"><History className="h-4 w-4 mr-1" /> History</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <h4 className="font-semibold text-sm mb-2">Page history</h4>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {versions.length === 0 && <p className="text-xs text-muted-foreground">No previous versions yet.</p>}
                {versions.map((v) => (
                  <div key={v.id} className="rounded border border-border p-2 text-xs">
                    <div className="font-medium truncate">{v.title}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {profileMap.get(v.edited_by ?? "")?.display_name ?? "Unknown"} · {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this page?")) del.mutate(); }} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mx-auto max-w-3xl px-8 py-10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
          />
          <div className="mt-6">
            {initRef.current === pageId && (
              <PageEditor key={pageId} content={content} onChange={setContent} />
            )}
          </div>
          <CommentsPanel pageId={pageId} />
        </div>
      </main>
    </div>
  );
}
