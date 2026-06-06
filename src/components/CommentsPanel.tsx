import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listComments, addComment, deleteComment, listProfiles } from "@/lib/wiki.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function CommentsPanel({ pageId }: { pageId: string }) {
  const listCommentsFn = useServerFn(listComments);
  const addCommentFn = useServerFn(addComment);
  const deleteCommentFn = useServerFn(deleteComment);
  const listProfilesFn = useServerFn(listProfiles);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", pageId],
    queryFn: () => listCommentsFn({ data: { pageId } }),
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"], queryFn: () => listProfilesFn(),
  });
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const add = useMutation({
    mutationFn: () => addCommentFn({ data: { pageId, content: text } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["comments", pageId] }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteCommentFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", pageId] }),
  });

  return (
    <div className="border-t border-border pt-6 mt-12">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
        <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
      </h3>
      <div className="space-y-4">
        {comments.map((c) => {
          const author = profileMap.get(c.author_id);
          return (
            <div key={c.id} className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(author?.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium">{author?.display_name ?? "Unknown"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  {me === c.author_id && (
                    <button onClick={() => del.mutate(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          );
        })}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Start the discussion.</p>}
      </div>
      <div className="mt-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment… Use @ to mention" rows={3} />
        <div className="mt-2 flex justify-end">
          <Button onClick={() => add.mutate()} disabled={!text.trim() || add.isPending}>
            {add.isPending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
