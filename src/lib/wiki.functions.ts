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

export const searchAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ q: z.string().min(1).max(100) }))
  .handler(async ({ data, context }) => {
    const term = `%${data.q}%`;
    const [pages, spaces] = await Promise.all([
      context.supabase.from("pages").select("id, title, space_id").ilike("title", term).limit(20),
      context.supabase.from("spaces").select("id, name, key").ilike("name", term).limit(10),
    ]);
    return { pages: pages.data ?? [], spaces: spaces.data ?? [] };
  });
