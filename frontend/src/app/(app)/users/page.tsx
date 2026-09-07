"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Pencil, Power, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Paginated, Role, User } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useDepartments } from "@/hooks/use-reference-data";
import { usePagination } from "@/hooks/use-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Pagination } from "@/components/ui/pagination";
import { Dialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { TableCard } from "@/components/ui/table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const schema = z.object({
  username: z.string().min(1, "Required"),
  password: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || v.length >= 8, "At least 8 characters"),
  fullname: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  roleId: z.string().min(1, "Required"),
  departmentId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [editingUser, setEditingUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [roleFilter, setRoleFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { register, control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const isOpen = editingUser !== undefined;

  const { data: roles } = useQuery({ queryKey: ["/roles"], queryFn: async () => (await apiClient.get<Role[]>("/roles")).data });
  const { data: departments } = useDepartments();

  const { data, isLoading } = useQuery({
    queryKey: ["/users"],
    queryFn: async () => (await apiClient.get<Paginated<User>>("/users", { params: { pageSize: 100 } })).data,
  });

  const filtered = useMemo(() => {
    let rows = data?.data ?? [];
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    if (roleFilter) rows = rows.filter((r) => r.roleId === roleFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.fullname.toLowerCase().includes(q) || r.username.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    }
    return rows;
  }, [data, search, statusFilter, roleFilter]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, `${search}|${statusFilter}|${roleFilter}`);
  const selectableIds = useMemo(() => paged.filter((u) => u.id !== currentUser?.sub).map((u) => u.id), [paged, currentUser]);

  function openCreate() {
    reset({ username: "", password: "", fullname: "", email: "", roleId: "", departmentId: "" });
    setError(null);
    setEditingUser(null);
  }

  function openEdit(user: User) {
    reset({ username: user.username, password: "", fullname: user.fullname, email: user.email, roleId: user.roleId, departmentId: user.departmentId ?? "" });
    setError(null);
    setEditingUser(user);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
      if (editingUser) return (await apiClient.patch(`/users/${editingUser.id}`, payload)).data;
      if (!values.password) throw new Error("Password is required for new users");
      return (await apiClient.post("/users", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/users"] });
      setEditingUser(undefined);
      setError(null);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to save") : err instanceof Error ? err.message : "Failed to save";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (user: User) => {
      await apiClient.patch(`/users/${user.id}`, { status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (user: User) => {
      await apiClient.delete(`/users/${user.id}`);
    },
    onSuccess: (_data, user) => {
      setActionError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/users"] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to delete") : "Failed to delete";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  function handleDelete(user: User) {
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    deleteMutation.mutate(user);
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selected.size} selected user(s)? This cannot be undone.`)) return;
    setActionError(null);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/users/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) setActionError(`${failed} of ${ids.length} could not be deleted (still referenced elsewhere).`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["/users"] });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of selectableIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <Button onClick={openCreate}>New User</Button>
      </div>

      {actionError && (
        <div className="flex items-center justify-between rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      <Dialog open={isOpen} onClose={() => setEditingUser(undefined)} title={editingUser ? "Edit User" : "New User"} className="max-w-2xl">
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Username *</Label>
            <Input {...register("username")} />
          </div>
          {!editingUser && (
            <div className="flex flex-col gap-1.5">
              <Label>Temporary Password *</Label>
              <Input type="password" {...register("password")} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Full Name *</Label>
            <Input {...register("fullname")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email *</Label>
            <Input type="email" {...register("email")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role *</Label>
            <Controller
              control={control}
              name="roleId"
              render={({ field }) => (
                <Combobox
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select role"
                  options={roles?.map((r) => ({ value: r.id, label: r.name })) ?? []}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Department</Label>
            <Controller
              control={control}
              name="departmentId"
              render={({ field }) => (
                <Combobox
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select department"
                  emptyOptionLabel="None"
                  options={departments?.data.map((d) => ({ value: d.id, label: d.name })) ?? []}
                />
              )}
            />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      <TableCard
        title="Users"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users..."
        filterActive={statusFilter !== "ALL" || !!roleFilter}
        filterContent={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
        headerExtra={
          selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selected.size})
            </Button>
          )
        }
      >
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading...</p>
        ) : (
          <>
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-[#206bc4]"
                    checked={selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((user) => {
                const isSelf = user.id === currentUser?.sub;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-[#206bc4] disabled:opacity-30"
                        checked={selected.has(user.id)}
                        onChange={() => toggleRow(user.id)}
                        disabled={isSelf}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.fullname} />
                        <div>
                          <p className="font-medium text-foreground">{user.fullname}</p>
                          <p className="text-xs text-[var(--color-muted)]">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.role?.name}</TableCell>
                    <TableCell>{user.department?.name ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={user.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton icon={Pencil} title="Edit" onClick={() => openEdit(user)} />
                        <IconButton
                          icon={Power}
                          title={user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          onClick={() => toggleStatusMutation.mutate(user)}
                          disabled={toggleStatusMutation.isPending}
                        />
                        <IconButton
                          icon={Trash2}
                          title={isSelf ? "You cannot delete your own account" : "Delete"}
                          variant="danger"
                          onClick={() => handleDelete(user)}
                          disabled={deleteMutation.isPending || isSelf}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination page={page} pageCount={pageCount} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
          </>
        )}
      </TableCard>
    </div>
  );
}
