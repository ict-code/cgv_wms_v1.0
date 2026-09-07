"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Pencil, Power, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";
import { usePagination } from "@/hooks/use-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Pagination } from "@/components/ui/pagination";
import { Dialog } from "@/components/ui/dialog";
import { ImportExportBar } from "@/components/master-data/import-export-bar";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { TableCard } from "@/components/ui/table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  emptyOptionLabel?: string;
}

export interface ColumnConfig<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface BaseRecord {
  id: string;
  status: "ACTIVE" | "INACTIVE";
}

function singularize(title: string): string {
  if (title.endsWith("ies")) return `${title.slice(0, -3)}y`;
  if (title.endsWith("s")) return title.slice(0, -1);
  return title;
}

function buildSchema(fields: FieldConfig[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    let base: z.ZodTypeAny = field.type === "number" ? z.coerce.number() : z.string();
    if (!field.required) base = base.optional().or(z.literal(""));
    shape[field.name] = base;
  }
  return z.object(shape);
}

export function ResourceCrudPage<T extends BaseRecord>({
  title,
  endpoint,
  fields,
  columns,
  nameField,
  subtitleField,
}: {
  title: string;
  endpoint: string;
  fields: FieldConfig[];
  columns: ColumnConfig<T>[];
  nameField: keyof T & string;
  subtitleField?: keyof T & string;
}) {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<T | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const schema = buildSchema(fields);
  const { register, control, handleSubmit, reset } = useForm<Record<string, unknown>>({ resolver: zodResolver(schema) });
  const singular = singularize(title);
  const isOpen = editingItem !== undefined;

  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<T>>(endpoint, { params: { pageSize: 100 } });
      return data;
    },
  });

  const filtered = useMemo(() => {
    let rows = data?.data ?? [];
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const name = String((r as unknown as Record<string, unknown>)[nameField] ?? "").toLowerCase();
        const subtitle = subtitleField ? String((r as unknown as Record<string, unknown>)[subtitleField] ?? "").toLowerCase() : "";
        return name.includes(q) || subtitle.includes(q);
      });
    }
    return rows;
  }, [data, search, statusFilter, nameField, subtitleField]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, `${search}|${statusFilter}`);

  function openCreate() {
    reset(Object.fromEntries(fields.map((f) => [f.name, ""])));
    setError(null);
    setEditingItem(null);
  }

  function openEdit(item: T) {
    reset(Object.fromEntries(fields.map((f) => [f.name, (item as unknown as Record<string, unknown>)[f.name] ?? ""])));
    setError(null);
    setEditingItem(item);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
      if (editingItem) {
        const { data } = await apiClient.patch(`${endpoint}/${editingItem.id}`, payload);
        return data;
      }
      const { data } = await apiClient.post(endpoint, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setEditingItem(undefined);
      setError(null);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to save") : "Failed to save";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (item: T) => {
      const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await apiClient.patch(`${endpoint}/${item.id}`, { status: nextStatus });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [endpoint] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: T) => {
      await apiClient.delete(`${endpoint}/${item.id}`);
    },
    onSuccess: (_data, item) => {
      setActionError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to delete") : "Failed to delete";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  function handleDelete(item: T) {
    if (!window.confirm(`Delete this ${singular.toLowerCase()}? This cannot be undone.`)) return;
    deleteMutation.mutate(item);
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selected.size} selected ${singular.toLowerCase()}(s)? This cannot be undone.`)) return;
    setActionError(null);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`${endpoint}/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) setActionError(`${failed} of ${ids.length} could not be deleted (still referenced elsewhere).`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: [endpoint] });
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
    const allSelected = paged.length > 0 && paged.every((r) => selected.has(r.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of paged) {
        if (allSelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <div className="flex items-center gap-2">
          <ImportExportBar
            endpoint={endpoint}
            resourceName={endpoint.replace(/^\//, "")}
            onImported={() => queryClient.invalidateQueries({ queryKey: [endpoint] })}
          />
          <Button onClick={openCreate}>New {singular}</Button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      <Dialog open={isOpen} onClose={() => setEditingItem(undefined)} title={editingItem ? `Edit ${singular}` : `New ${singular}`}>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </Label>
              {field.type === "select" ? (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: rhf }) => (
                    <Combobox
                      id={field.name}
                      value={typeof rhf.value === "string" ? rhf.value : ""}
                      onChange={rhf.onChange}
                      options={field.options ?? []}
                      placeholder={`Select ${field.label.toLowerCase()}`}
                      emptyOptionLabel={field.emptyOptionLabel ?? "None"}
                    />
                  )}
                />
              ) : (
                <Input id={field.name} type={field.type === "number" ? "number" : field.type ?? "text"} step="any" {...register(field.name)} />
              )}
            </div>
          ))}
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      <TableCard
        title={title}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
        filterActive={statusFilter !== "ALL"}
        filterContent={
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
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
                    checked={paged.length > 0 && paged.every((r) => selected.has(r.id))}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>{singular}</TableHead>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((item) => {
                const name = String((item as unknown as Record<string, unknown>)[nameField] ?? "");
                const subtitle = subtitleField ? String((item as unknown as Record<string, unknown>)[subtitleField] ?? "") : undefined;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-[#206bc4]"
                        checked={selected.has(item.id)}
                        onChange={() => toggleRow(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={name} />
                        <div>
                          <p className="font-medium text-foreground">{name}</p>
                          {subtitle && <p className="text-xs text-[var(--color-muted)]">{subtitle}</p>}
                        </div>
                      </div>
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.key}>{col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}</TableCell>
                    ))}
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton icon={Pencil} title="Edit" onClick={() => openEdit(item)} />
                        <IconButton
                          icon={Power}
                          title={item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          onClick={() => toggleStatusMutation.mutate(item)}
                          disabled={toggleStatusMutation.isPending}
                        />
                        <IconButton icon={Trash2} title="Delete" variant="danger" onClick={() => handleDelete(item)} disabled={deleteMutation.isPending} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 4} className="text-center text-slate-400">
                    No records found
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
