"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Pencil, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Role } from "@/lib/types";
import { NAV_SECTIONS } from "@/components/layout/nav-config";
import { usePagination } from "@/hooks/use-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { TableCard } from "@/components/ui/table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MODULE_SECTIONS = NAV_SECTIONS.map((section) => ({
  title: section.title ?? "General",
  items: section.items.filter((item) => !!item.moduleKey),
})).filter((section) => section.items.length > 0);

const schema = z.object({
  name: z.string().min(1, "Required"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<Role | null | undefined>(undefined);
  const [moduleKeys, setModuleKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { register, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const isOpen = editingRole !== undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["/roles"],
    queryFn: async () => (await apiClient.get<Role[]>("/roles")).data,
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [data, search]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, search);

  function openCreate() {
    reset({ name: "", description: "" });
    setModuleKeys(new Set());
    setError(null);
    setEditingRole(null);
  }

  function openEdit(role: Role) {
    reset({ name: role.name, description: role.description ?? "" });
    setModuleKeys(new Set(role.modules));
    setError(null);
    setEditingRole(role);
  }

  function toggleModule(key: string) {
    setModuleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, modules: [...moduleKeys] };
      if (editingRole) return (await apiClient.patch(`/roles/${editingRole.id}`, payload)).data;
      return (await apiClient.post("/roles", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/roles"] });
      setEditingRole(undefined);
      setError(null);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to save") : "Failed to save";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (role: Role) => {
      await apiClient.delete(`/roles/${role.id}`);
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["/roles"] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to delete") : "Failed to delete";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  function handleDelete(role: Role) {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(role);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Roles</h1>
        <Button onClick={openCreate}>New Role</Button>
      </div>

      {actionError && (
        <div className="flex items-center justify-between rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      <Dialog open={isOpen} onClose={() => setEditingRole(undefined)} title={editingRole ? "Edit Role" : "New Role"} className="max-w-2xl">
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name *</Label>
              <Input {...register("name")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea rows={1} {...register("description")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Module Access</Label>
            <div className="grid grid-cols-1 gap-4 rounded-md border border-[var(--color-border)] p-3 sm:grid-cols-2">
              {MODULE_SECTIONS.map((section) => (
                <div key={section.title} className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">{section.title}</p>
                  {section.items.map((item) => (
                    <label key={item.moduleKey} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-[#206bc4]"
                        checked={moduleKeys.has(item.moduleKey!)}
                        onChange={() => toggleModule(item.moduleKey!)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      <TableCard title="Roles" search={search} onSearchChange={setSearch} searchPlaceholder="Search roles...">
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading...</p>
        ) : (
          <>
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={role.name} />
                      <p className="font-medium text-foreground">{role.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <StatusBadge status={role.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton icon={Pencil} title="Edit" onClick={() => openEdit(role)} />
                      <IconButton
                        icon={Trash2}
                        title="Delete"
                        variant="danger"
                        onClick={() => handleDelete(role)}
                        disabled={deleteMutation.isPending}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-400">
                    No roles found
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
