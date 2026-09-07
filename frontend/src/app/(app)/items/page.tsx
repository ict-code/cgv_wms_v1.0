"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { FileSpreadsheet, Pencil, Power, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Category, Item, Paginated, Unit } from "@/lib/types";
import { usePagination } from "@/hooks/use-pagination";
import { downloadFile } from "@/lib/download";
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
import { formatCurrency, formatQuantity } from "@/lib/utils";

const schema = z.object({
  itemCode: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  barcode: z.string().optional().or(z.literal("")),
  categoryId: z.string().min(1, "Required"),
  unitId: z.string().min(1, "Required"),
  brand: z.string().optional().or(z.literal("")),
  reorderLevel: z.coerce.number().optional(),
  standardCost: z.coerce.number().optional(),
  trackSerial: z.boolean().optional(),
  trackBatch: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export default function ItemsPage() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<Item | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { register, control, handleSubmit, reset } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });
  const isOpen = editingItem !== undefined;

  const { data: categories } = useQuery({
    queryKey: ["/categories"],
    queryFn: async () => (await apiClient.get<Paginated<Category>>("/categories", { params: { pageSize: 100 } })).data,
  });
  const { data: units } = useQuery({
    queryKey: ["/units"],
    queryFn: async () => (await apiClient.get<Paginated<Unit>>("/units", { params: { pageSize: 100 } })).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/items", search, categoryFilter],
    queryFn: async () =>
      (await apiClient.get<Paginated<Item>>("/items", { params: { search: search || undefined, categoryId: categoryFilter || undefined, pageSize: 200 } })).data,
  });

  const filtered = useMemo(() => {
    let rows = data?.data ?? [];
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    return rows;
  }, [data, statusFilter]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, `${search}|${categoryFilter}|${statusFilter}`);

  function openCreate() {
    reset({
      itemCode: "",
      name: "",
      barcode: "",
      categoryId: "",
      unitId: "",
      brand: "",
      reorderLevel: 0,
      standardCost: 0,
      trackSerial: false,
      trackBatch: false,
      trackExpiry: false,
    });
    setError(null);
    setEditingItem(null);
  }

  function openEdit(item: Item) {
    reset({
      itemCode: item.itemCode,
      name: item.name,
      barcode: item.barcode ?? "",
      categoryId: item.categoryId,
      unitId: item.unitId,
      brand: item.brand ?? "",
      reorderLevel: Number(item.reorderLevel),
      standardCost: Number(item.standardCost),
      trackSerial: item.trackSerial,
      trackBatch: item.trackBatch,
      trackExpiry: item.trackExpiry,
    });
    setError(null);
    setEditingItem(item);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
      if (editingItem) return (await apiClient.patch(`/items/${editingItem.id}`, payload)).data;
      return (await apiClient.post("/items", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/items"] });
      setEditingItem(undefined);
      setError(null);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to save") : "Failed to save";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (item: Item) => {
      await apiClient.patch(`/items/${item.id}`, { status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/items"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: Item) => {
      await apiClient.delete(`/items/${item.id}`);
    },
    onSuccess: (_data, item) => {
      setActionError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/items"] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to delete") : "Failed to delete";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  function handleDelete(item: Item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(item);
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selected.size} selected item(s)? This cannot be undone.`)) return;
    setActionError(null);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/items/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) setActionError(`${failed} of ${ids.length} could not be deleted (still referenced elsewhere).`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["/items"] });
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
        <h1 className="text-2xl font-bold text-foreground">Items</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadFile("/items/export.xlsx", "items.xlsx")}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Download Excel
          </Button>
          <Button onClick={openCreate}>New Item</Button>
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

      <Dialog open={isOpen} onClose={() => setEditingItem(undefined)} title={editingItem ? "Edit Item" : "New Item"} className="max-w-2xl">
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="itemCode">Item Code *</Label>
            <Input id="itemCode" {...register("itemCode")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="barcode">Barcode</Label>
            <Input id="barcode" {...register("barcode")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categoryId">Category *</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Combobox
                  id="categoryId"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select category"
                  options={categories?.data.map((c) => ({ value: c.id, label: c.name })) ?? []}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unitId">Unit *</Label>
            <Controller
              control={control}
              name="unitId"
              render={({ field }) => (
                <Combobox
                  id="unitId"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select unit"
                  options={units?.data.map((u) => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })) ?? []}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" {...register("brand")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reorderLevel">Reorder Level</Label>
            <Input id="reorderLevel" type="number" step="any" {...register("reorderLevel")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="standardCost">Standard Cost</Label>
            <Input id="standardCost" type="number" step="any" {...register("standardCost")} />
          </div>
          <div className="flex items-end gap-4 pb-1.5">
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" {...register("trackSerial")} /> Serial
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" {...register("trackBatch")} /> Batch
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" {...register("trackExpiry")} /> Expiry
            </label>
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
        title="Items"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code, barcode, name, or brand..."
        filterActive={statusFilter !== "ALL" || !!categoryFilter}
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
              <Label className="text-xs">Category</Label>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All</option>
                {categories?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
                    checked={paged.length > 0 && paged.every((r) => selected.has(r.id))}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Standard Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((item) => (
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
                      <Avatar name={item.name} />
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-[var(--color-muted)]">{item.itemCode}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{item.category?.name}</TableCell>
                  <TableCell>{item.unit?.abbreviation}</TableCell>
                  <TableCell>{formatQuantity(item.reorderLevel)}</TableCell>
                  <TableCell>{formatCurrency(item.standardCost)}</TableCell>
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
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-400">
                    No items found
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
