import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppSidebar } from "@/components/AppSidebar";
import {
  adminCreateUser,
  adminDeleteUser,
  adminListSpaceMembers,
  adminListUsers,
  adminRemoveSpaceMember,
  adminSetGlobalAdmin,
  adminSetPassword,
  adminSetSpaceMember,
  getMyRoleInfo,
} from "@/lib/admin.functions";
import { listSpaces } from "@/lib/wiki.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KeyRound, Trash2, Shield, ShieldOff, UserPlus, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  ssr: false,
  beforeLoad: async () => {
    const { getMyRoleInfo } = await import("@/lib/admin.functions");
    const info = await getMyRoleInfo();
    if (!info.isAdmin) throw redirect({ to: "/home" });
  },
  head: () => ({ meta: [{ title: "Admin · Users — WikiSpace" }] }),
  component: AdminUsersPage,
});

type Role = "viewer" | "editor" | "admin";

function AdminUsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const spacesFn = useServerFn(listSpaces);
  const createFn = useServerFn(adminCreateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const pwFn = useServerFn(adminSetPassword);
  const setAdminFn = useServerFn(adminSetGlobalAdmin);
  const meFn = useServerFn(getMyRoleInfo);

  const { data: me } = useQuery({ queryKey: ["me-role"], queryFn: () => meFn() });
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: () => spacesFn() });

  // create
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", makeAdmin: false });
  const createM = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success("User created");
      setOpenCreate(false);
      setForm({ username: "", password: "", displayName: "", makeAdmin: false });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // password
  const [pwUser, setPwUser] = useState<{ id: string; username: string } | null>(null);
  const [newPw, setNewPw] = useState("");
  const pwM = useMutation({
    mutationFn: () => pwFn({ data: { userId: pwUser!.id, password: newPw } }),
    onSuccess: () => { toast.success("Password updated"); setPwUser(null); setNewPw(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  // delete
  const delM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { userId: id } }),
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // toggle admin
  const adminM = useMutation({
    mutationFn: (v: { userId: string; makeAdmin: boolean }) => setAdminFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // permissions panel
  const [permsUser, setPermsUser] = useState<{ id: string; username: string } | null>(null);

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link to="/home" className="hover:underline">Home</Link> / Admin
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight flex items-center gap-2">
                <UsersIcon className="h-6 w-6" /> Users
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create users, reset passwords, and grant per-space permissions.
              </p>
            </div>

            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button><UserPlus className="mr-1.5 h-4 w-4" />New user</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Display name</Label>
                    <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Username</Label>
                    <Input value={form.username} autoCapitalize="none" onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.makeAdmin} onCheckedChange={(c) => setForm({ ...form, makeAdmin: !!c })} />
                    Make this user a global admin
                  </label>
                </div>
                <DialogFooter>
                  <Button onClick={() => createM.mutate()} disabled={!form.username || !form.password || createM.isPending}>
                    {createM.isPending ? "Creating…" : "Create user"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">User</th>
                  <th className="px-4 py-2.5 text-left">Role</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.display_name}</div>
                      <div className="text-xs text-muted-foreground">@{u.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_admin
                        ? <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Admin</Badge>
                        : <Badge variant="secondary">Member</Badge>}
                      {me?.userId === u.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setPermsUser({ id: u.id, username: u.username })}>
                          Spaces
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setPwUser({ id: u.id, username: u.username }); setNewPw(""); }}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {u.is_admin
                          ? <Button size="sm" variant="ghost" disabled={me?.userId === u.id} title="Revoke admin"
                              onClick={() => adminM.mutate({ userId: u.id, makeAdmin: false })}><ShieldOff className="h-4 w-4" /></Button>
                          : <Button size="sm" variant="ghost" title="Make admin"
                              onClick={() => adminM.mutate({ userId: u.id, makeAdmin: true })}><Shield className="h-4 w-4" /></Button>}
                        <Button size="sm" variant="ghost" disabled={me?.userId === u.id}
                          onClick={() => { if (confirm(`Delete user @${u.username}?`)) delM.mutate(u.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && users.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Reset password dialog */}
      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set password for @{pwUser?.username}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>New password</Label>
            <Input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <DialogFooter>
            <Button onClick={() => pwM.mutate()} disabled={newPw.length < 6 || pwM.isPending}>
              {pwM.isPending ? "Saving…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Space permissions dialog */}
      <Dialog open={!!permsUser} onOpenChange={(o) => !o && setPermsUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Space access for @{permsUser?.username}</DialogTitle></DialogHeader>
          {permsUser && (
            <SpacePermissionsEditor userId={permsUser.id} spaces={spaces as any[]} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpacePermissionsEditor({ userId, spaces }: { userId: string; spaces: { id: string; name: string; icon: string }[] }) {
  const qc = useQueryClient();
  const setFn = useServerFn(adminSetSpaceMember);
  const removeFn = useServerFn(adminRemoveSpaceMember);
  const listMembersFn = useServerFn(adminListSpaceMembers);

  // Load membership for each space (parallel)
  const queries = useQuery({
    queryKey: ["user-space-membership", userId],
    queryFn: async () => {
      const results = await Promise.all(
        spaces.map((s) => listMembersFn({ data: { spaceId: s.id } }).then((rows: any[]) => ({ spaceId: s.id, rows }))),
      );
      const map = new Map<string, Role | undefined>();
      for (const { spaceId, rows } of results) {
        const mine = rows.find((r) => r.user_id === userId);
        map.set(spaceId, mine?.role as Role | undefined);
      }
      return map;
    },
  });

  const setM = useMutation({
    mutationFn: (v: { spaceId: string; role: Role }) => setFn({ data: { ...v, userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-space-membership", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const remM = useMutation({
    mutationFn: (spaceId: string) => removeFn({ data: { spaceId, userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-space-membership", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (queries.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (spaces.length === 0) return <p className="text-sm text-muted-foreground">No spaces exist yet.</p>;

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {spaces.map((s) => {
        const current = queries.data?.get(s.id);
        return (
          <div key={s.id} className="flex items-center gap-3 rounded-md border border-border p-3">
            <div className="text-xl">{s.icon}</div>
            <div className="flex-1 truncate font-medium">{s.name}</div>
            <Select
              value={current ?? "none"}
              onValueChange={(v) => {
                if (v === "none") remM.mutate(s.id);
                else setM.mutate({ spaceId: s.id, role: v as Role });
              }}
            >
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No access</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
