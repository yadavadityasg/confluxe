import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plus, BookOpen, Search, LogOut, ChevronRight, ChevronDown, FileText, Home, Menu, PanelLeftClose, Shield, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { listSpaces, listPages, createPage, createSpace } from "@/lib/wiki.functions";
import { getMyRoleInfo } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type PageRow = { id: string; parent_id: string | null; title: string; space_id: string };

function buildTree(pages: PageRow[]) {
  const byParent = new Map<string | null, PageRow[]>();
  for (const p of pages) {
    const k = p.parent_id;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(p);
  }
  return byParent;
}

function PageNode({ page, tree, spaceId, depth, currentPageId, onNavigate }: {
  page: PageRow; tree: Map<string | null, PageRow[]>; spaceId: string; depth: number; currentPageId?: string; onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const children = tree.get(page.id) ?? [];
  const isActive = page.id === currentPageId;
  return (
    <div>
      <div className={`group flex items-center gap-1 rounded-md px-1 py-1 text-sm hover:bg-sidebar-accent ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}>
        {children.length > 0 ? (
          <button onClick={() => setOpen(!open)} className="grid h-5 w-5 place-items-center text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-5" />}
        <Link to="/spaces/$spaceId/pages/$pageId" params={{ spaceId, pageId: page.id }} onClick={onNavigate} className="flex items-center gap-1.5 flex-1 truncate">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate">{page.title || "Untitled"}</span>
        </Link>
      </div>
      {open && children.map((c) => (
        <PageNode key={c.id} page={c} tree={tree} spaceId={spaceId} depth={depth + 1} currentPageId={currentPageId} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function SpaceSection({ space, currentSpaceId, currentPageId, onNavigate }: {
  space: { id: string; name: string; icon: string; key: string };
  currentSpaceId?: string; currentPageId?: string; onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(space.id === currentSpaceId);
  const listPagesFn = useServerFn(listPages);
  const createPageFn = useServerFn(createPage);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: pages = [] } = useQuery({
    queryKey: ["pages", space.id],
    queryFn: () => listPagesFn({ data: { spaceId: space.id } }),
    enabled: open,
  });
  const tree = useMemo(() => buildTree(pages as PageRow[]), [pages]);
  const roots = tree.get(null) ?? [];

  const newPage = useMutation({
    mutationFn: () => createPageFn({ data: { spaceId: space.id } }),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: ["pages", space.id] });
      navigate({ to: "/spaces/$spaceId/pages/$pageId", params: { spaceId: space.id, pageId: page.id } });
      onNavigate?.();
    },
  });

  return (
    <div className="mb-1">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-1.5 text-sm font-medium text-sidebar-foreground hover:text-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span className="text-base">{space.icon}</span>
          <Link to="/spaces/$spaceId" params={{ spaceId: space.id }} onClick={onNavigate} className="truncate hover:underline">{space.name}</Link>
        </button>
        <button onClick={() => newPage.mutate()} title="New page" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="ml-2">
          {roots.length === 0 && <p className="px-3 py-1 text-xs text-muted-foreground">No pages yet</p>}
          {roots.map((p) => (
            <PageNode key={p.id} page={p} tree={tree} spaceId={space.id} depth={0} currentPageId={currentPageId} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const isMobile = !!useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username: string; displayName: string } | null>(null);

  const listSpacesFn = useServerFn(listSpaces);
  const createSpaceFn = useServerFn(createSpace);
  const meFn = useServerFn(getMyRoleInfo);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const spaceMatch = pathname.match(/^\/spaces\/([^/]+)/);
  const pageMatch = pathname.match(/^\/spaces\/[^/]+\/pages\/([^/]+)/);
  const currentSpaceId = spaceMatch?.[1];
  const currentPageId = pageMatch?.[1];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) {
        const meta = u.user_metadata as Record<string, string> | undefined;
        const username = meta?.username || u.email?.split("@")[0] || "User";
        setUserInfo({ username, displayName: meta?.display_name || username });
      }
    });
  }, []);

  const { data: spaces = [] } = useQuery({
    queryKey: ["spaces"],
    queryFn: () => listSpacesFn(),
  });
  const { data: me } = useQuery({ queryKey: ["me-role"], queryFn: () => meFn() });
  const isAdmin = !!me?.isAdmin;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: "", name: "", description: "", icon: "📘" });

  const newSpace = useMutation({
    mutationFn: () => createSpaceFn({ data: form }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["spaces"] });
      toast.success("Space created");
      setOpen(false);
      setForm({ key: "", name: "", description: "", icon: "📘" });
      navigate({ to: "/spaces/$spaceId", params: { spaceId: s.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Mobile closed state — render a floating hamburger
  if (isMobile && !mobileOpen) {
    return (
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background shadow-sm"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>
    );
  }

  // Desktop collapsed state — render a narrow icon strip
  if (!isMobile && collapsed) {
    return (
      <aside className="flex h-screen w-14 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center justify-center border-b border-sidebar-border px-2 py-3">
          <button
            onClick={() => setCollapsed(false)}
            className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold"
            title="Expand sidebar"
          >
            C
          </button>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 py-3">
          <Link
            to="/home"
            className={`grid h-8 w-8 place-items-center rounded-md hover:bg-sidebar-accent ${pathname === "/home" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"}`}
            title="Home"
          >
            <Home className="h-4 w-4" />
          </Link>
          <Link
            to="/search"
            className={`grid h-8 w-8 place-items-center rounded-md hover:bg-sidebar-accent ${pathname === "/search" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"}`}
            title="Search"
          >
            <Search className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {spaces.map((s) => (
            <Link
              key={s.id}
              to="/spaces/$spaceId"
              params={{ spaceId: s.id }}
              className={`grid h-9 w-9 place-items-center rounded-md hover:bg-sidebar-accent text-lg ${currentSpaceId === s.id ? "bg-sidebar-accent" : ""}`}
              title={s.name}
            >
              {s.icon}
            </Link>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1 border-t border-sidebar-border px-2 py-3">
          <button
            onClick={() => setOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            title="New space"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-accent" title={userInfo?.displayName || userInfo?.username || "User"}>
            <User className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <button
            onClick={signOut}
            className="grid h-8 w-8 place-items-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a space</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-16">
                  <Label>Icon</Label>
                  <Input value={form.icon} maxLength={4} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="text-center" />
                </div>
                <div className="flex-1">
                  <Label>Key</Label>
                  <Input placeholder="ENG" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div>
                <Label>Name</Label>
                <Input placeholder="Engineering" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Input placeholder="What lives here?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => newSpace.mutate()} disabled={!form.name || !form.key || newSpace.isPending}>
                {newSpace.isPending ? "Creating…" : "Create space"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
    );
  }

  const sidebarBody = (
    <>
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold">C</div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-sidebar-foreground">WikiSpace</div>
          <div className="text-[11px] text-muted-foreground">Team Wiki</div>
        </div>
        {!isMobile && (
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:bg-sidebar-accent"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-1 px-2 py-3">
        <Link to="/home" className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent ${pathname === "/home" ? "bg-sidebar-accent font-medium" : ""}`}>
          <Home className="h-4 w-4" /> Home
        </Link>
        <Link to="/search" className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent ${pathname === "/search" ? "bg-sidebar-accent font-medium" : ""}`}>
          <Search className="h-4 w-4" /> Search
        </Link>
        {isAdmin && (
          <Link to="/admin/users" className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent ${pathname.startsWith("/admin") ? "bg-sidebar-accent font-medium" : ""}`}>
            <Shield className="h-4 w-4" /> Users
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between px-3 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spaces</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button title="New space" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a space</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-16">
                  <Label>Icon</Label>
                  <Input value={form.icon} maxLength={4} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="text-center" />
                </div>
                <div className="flex-1">
                  <Label>Key</Label>
                  <Input placeholder="ENG" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div>
                <Label>Name</Label>
                <Input placeholder="Engineering" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Input placeholder="What lives here?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => newSpace.mutate()} disabled={!form.name || !form.key || newSpace.isPending}>
                {newSpace.isPending ? "Creating…" : "Create space"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {spaces.length === 0 && (
          <div className="px-3 py-6 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-xs text-muted-foreground">No spaces yet</p>
            <button onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-primary hover:underline">Create your first</button>
          </div>
        )}
        {spaces.map((s) => (
          <SpaceSection key={s.id} space={s} currentSpaceId={currentSpaceId} currentPageId={currentPageId} onNavigate={() => setMobileOpen(false)} />
        ))}
      </div>

      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-accent">
            <User className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{userInfo?.displayName || userInfo?.username || "User"}</div>
            <div className="text-xs text-muted-foreground truncate">{userInfo?.username ? `@${userInfo.username}` : ""}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`flex h-screen flex-col border-r border-sidebar-border bg-sidebar ${
          isMobile && mobileOpen
            ? "fixed inset-y-0 left-0 z-50 w-72"
            : "w-72"
        }`}
      >
        {sidebarBody}
      </aside>
    </>
  );
}
