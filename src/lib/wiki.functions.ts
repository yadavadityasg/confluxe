import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSpaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("spaces")
      .select("id, key, name, description, icon, created_by, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    key: z.string().min(2).max(16).regex(/^[A-Z0-9_-]+$/i, "Letters, numbers, _ or - only"),
    name: z.string().min(1).max(80),
    description: z.string().max(280).optional(),
    icon: z.string().max(8).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { data: space, error } = await context.supabase
      .from("spaces")
      .insert({
        key: data.key.toUpperCase(),
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? "📘",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return space;
  });

export const getSpace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: space, error } = await context.supabase
      .from("spaces").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return space;
  });

export const listPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ spaceId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: pages, error } = await context.supabase
      .from("pages")
      .select("id, space_id, parent_id, title, position, updated_at, author_id")
      .eq("space_id", data.spaceId)
      .order("position");
    if (error) throw new Error(error.message);
    return pages ?? [];
  });

export const getPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: page, error } = await context.supabase
      .from("pages").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return page;
  });

export const createPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    spaceId: z.string().uuid(),
    parentId: z.string().uuid().nullable().optional(),
    title: z.string().max(200).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { data: page, error } = await context.supabase
      .from("pages")
      .insert({
        space_id: data.spaceId,
        parent_id: data.parentId ?? null,
        title: data.title ?? "Untitled",
        author_id: context.userId,
        last_edited_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return page;
  });

export const updatePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    title: z.string().max(200),
    content: z.any(),
  }))
  .handler(async ({ data, context }) => {
    const { data: page, error } = await context.supabase
      .from("pages")
      .update({ title: data.title.trim() || "Untitled", content: data.content, last_edited_by: context.userId })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return page;
  });

export const deletePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pageId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: versions, error } = await context.supabase
      .from("page_versions")
      .select("id, title, edited_by, created_at")
      .eq("page_id", data.pageId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return versions ?? [];
  });

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pageId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: comments, error } = await context.supabase
      .from("comments")
      .select("id, page_id, author_id, content, created_at")
      .eq("page_id", data.pageId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return comments ?? [];
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pageId: z.string().uuid(), content: z.string().min(1).max(2000) }))
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("comments")
      .insert({ page_id: data.pageId, content: data.content, author_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return c;
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("profiles").select("id, display_name, avatar_url");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

function extractText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  let out = "";
  if (typeof node.text === "string") out += node.text;
  if (Array.isArray(node.content)) {
    for (const c of node.content) out += " " + extractText(c);
  }
  return out;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type ContentMatch = {
  id: string;
  space_id: string;
  space_name: string;
  space_icon: string;
  parent_titles: string[];
  title: string;
  count: number;
  snippet: string;
  matchStart: number;
  matchLen: number;
};

export const searchAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ q: z.string().min(1).max(100) }))
  .handler(async ({ data, context }) => {
    const q = data.q.trim();
    const term = `%${q}%`;

    const [spacesRes, allSpacesRes, pagesRes] = await Promise.all([
      context.supabase.from("spaces").select("id, name, key, icon").or(`name.ilike.${term},key.ilike.${term}`).limit(10),
      context.supabase.from("spaces").select("id, name, icon"),
      context.supabase.from("pages").select("id, space_id, parent_id, title, content, updated_at"),
    ]);

    const spaceMap = new Map<string, { name: string; icon: string }>();
    for (const s of allSpacesRes.data ?? []) spaceMap.set(s.id, { name: s.name, icon: s.icon });

    const pages = pagesRes.data ?? [];
    const pageMap = new Map<string, (typeof pages)[number]>();
    for (const p of pages) pageMap.set(p.id, p);

    const ancestorTitles = (pageId: string): string[] => {
      const chain: string[] = [];
      const start = pageMap.get(pageId);
      let parentId = start?.parent_id ?? null;
      const seen = new Set<string>();
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parent = pageMap.get(parentId);
        if (!parent) break;
        chain.unshift(parent.title || "Untitled");
        parentId = parent.parent_id;
      }
      return chain;
    };

    const re = new RegExp(escapeRegex(q), "gi");
    const ql = q.toLowerCase();
    const titlePages: ContentMatch[] = [];
    const contentPages: ContentMatch[] = [];

    for (const p of pages) {
      const text = extractText(p.content).replace(/\s+/g, " ").trim();
      const titleMatch = (p.title || "").toLowerCase().includes(ql);
      const matches = text.match(re);
      const count = matches ? matches.length : 0;

      if (!titleMatch && count === 0) continue;

      const space = spaceMap.get(p.space_id);
      let snippet = "";
      let matchStart = -1;
      const idx = text.toLowerCase().indexOf(ql);
      if (idx >= 0) {
        const winStart = Math.max(0, idx - 60);
        const winEnd = Math.min(text.length, idx + q.length + 80);
        const prefix = winStart > 0 ? "… " : "";
        snippet = prefix + text.slice(winStart, winEnd) + (winEnd < text.length ? " …" : "");
        matchStart = idx - winStart + prefix.length;
      }

      const entry: ContentMatch = {
        id: p.id,
        space_id: p.space_id,
        space_name: space?.name ?? "",
        space_icon: space?.icon ?? "📘",
        parent_titles: ancestorTitles(p.id),
        title: p.title || "Untitled",
        count,
        snippet,
        matchStart,
        matchLen: q.length,
      };

      if (titleMatch) titlePages.push(entry);
      else contentPages.push(entry);
    }

    contentPages.sort((a, b) => b.count - a.count || (a.title < b.title ? -1 : 1));
    titlePages.sort((a, b) => b.count - a.count);

    return {
      spaces: spacesRes.data ?? [],
      titlePages,
      contentPages: contentPages.slice(0, 50),
    };
  });
