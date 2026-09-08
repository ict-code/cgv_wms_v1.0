"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Archive, PackageOpen, Pencil, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Paginated, StorageItem } from "@/lib/types";
import { useWarehouses, useLocations, useDepartments, useEmployees } from "@/hooks/use-reference-data";
import { usePagination } from "@/hooks/use-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Pagination } from "@/components/ui/pagination";
import { Dialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { TableCard } from "@/components/ui/table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ITEM_TYPE_OPTIONS = [
  { value: "DOCUMENT_BOX", label: "Document Box" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "OTHER", label: "Other" },
];

const schema = z.object({
  description: z.string().min(1, "Required"),
  itemType: z.enum(["DOCUMENT_BOX", "FURNITURE", "EQUIPMENT", "OTHER"]),
  quantity: z.coerce.number().int().min(1),
  warehouseId: z.string().min(1, "Required"),
  locationId: z.string().min(1, "Required"),
  ownerDepartmentId: z.string().optional(),
  custodianId: z.string().optional(),
  dateStored: z.string().optional(),
  disposalDueDate: z.string().optional(),
  notes: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export default function StorageItemsPage() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<StorageItem | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "STORED" | "RETRIEVED" | "DISPOSED">("ALL");
  const { register, control, handleSubmit, watch, reset, setValue } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });
  const isOpen = editingItem !== undefined;
  const warehouseId = watch("warehouseId");

  const { data: warehouses } = useWarehouses();
  const { data: locations } = useLocations(warehouseId);
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployees();

  const { data, isLoading } = useQuery({
    queryKey: ["/storage-items"],
    queryFn: async () => (await apiClient.get<Paginated<StorageItem>>("/storage-items", { params: { pageSize: 200 } })).data,
  });

  const filtered = useMemo(() => {
    let rows = data?.data ?? [];
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.description.toLowerCase().includes(q));
    }
    return rows;
  }, [data, search, statusFilter]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, `${search}|${statusFilter}`);

  function openCreate() {
    reset({ description: "", itemType: "OTHER", quantity: 1, warehouseId: "", locationId: "", ownerDepartmentId: "", custodianId: "", dateStored: "", disposalDueDate: "", notes: "" });
    setError(null);
    setEditingItem(null);
  }

  function openEdit(item: StorageItem) {
    reset({
      description: item.description,
      itemType: item.itemType,
      quantity: item.quantity,
      warehouseId: item.location?.warehouseId ?? "",
      locationId: item.locationId,
      ownerDepartmentId: item.ownerDepartmentId ?? "",
      custodianId: item.custodianId ?? "",
      dateStored: item.dateStored?.slice(0, 10) ?? "",
      disposalDueDate: item.disposalDueDate?.slice(0, 10) ?? "",
      notes: item.notes ?? "",
    });
    setError(null);
    setEditingItem(item);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { warehouseId: _warehouseId, ...rest } = values;
      const payload = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== "" && v !== undefined));
      if (editingItem) return (await apiClient.patch(`/storage-items/${editingItem.id}`, payload)).data;
      return (await apiClient.post("/storage-items", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/storage-items"] });
      setEditingItem(undefined);
      setError(null);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to save") : "Failed to save";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const retrieveMutation = useMutation({
    mutationFn: async (item: StorageItem) => (await apiClient.post(`/storage-items/${item.id}/retrieve`)).data,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["/storage-items"] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to retrieve") : "Failed to retrieve";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const disposeMutation = useMutation({
    mutationFn: async (item: StorageItem) => (await apiClient.post(`/storage-items/${item.id}/dispose`)).data,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["/storage-items"] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to dispose") : "Failed to dispose";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: StorageItem) => {
      await apiClient.delete(`/storage-items/${item.id}`);
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["/storage-items"] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to delete") : "Failed to delete";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  function handleDispose(item: StorageItem) {
    if (!window.confirm(`Mark "${item.description}" as disposed? This cannot be undone.`)) return;
    disposeMutation.mutate(item);
  }

  function handleDelete(item: StorageItem) {
    if (!window.confirm(`Permanently delete the record for "${item.description}"? This cannot be undone.`)) return;
    deleteMutation.mutate(item);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Storage Items</h1>
        <Button onClick={openCreate}>New Storage Item</Button>
      </div>

      {actionError && (
        <div className="flex items-center justify-between rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      <Dialog open={isOpen} onClose={() => setEditingItem(undefined)} title={editingItem ? "Edit Storage Item" : "New Storage Item"} className="max-w-2xl">
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Description *</Label>
            <Input {...register("description")} placeholder="e.g. Box of 2019 payroll records" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type *</Label>
            <Select {...register("itemType")}>
              {ITEM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Quantity *</Label>
            <Input type="number" min={1} {...register("quantity")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Warehouse *</Label>
            <Controller
              control={control}
              name="warehouseId"
              render={({ field }) => (
                <Combobox
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    setValue("locationId", "");
                  }}
                  placeholder="Select warehouse"
                  options={warehouses?.data.map((w) => ({ value: w.id, label: w.name })) ?? []}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Location *</Label>
            <Controller
              control={control}
              name="locationId"
              render={({ field }) => (
                <Combobox
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select location"
                  disabled={!warehouseId}
                  options={locations?.data.map((l) => ({ value: l.id, label: l.name })) ?? []}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Owner Department</Label>
            <Controller
              control={control}
              name="ownerDepartmentId"
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
          <div className="flex flex-col gap-1.5">
            <Label>Custodian</Label>
            <Controller
              control={control}
              name="custodianId"
              render={({ field }) => (
                <Combobox
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select employee"
                  emptyOptionLabel="None"
                  options={employees?.data.map((e) => ({ value: e.id, label: e.fullname })) ?? []}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Date Stored</Label>
            <Input type="date" {...register("dateStored")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Disposal Due Date</Label>
            <Input type="date" {...register("disposalDueDate")} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} {...register("notes")} />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      <TableCard
        title="Storage Items"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search storage items..."
        filterActive={statusFilter !== "ALL"}
        filterContent={
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="ALL">All</option>
              <option value="STORED">Stored</option>
              <option value="RETRIEVED">Retrieved</option>
              <option value="DISPOSED">Disposed</option>
            </Select>
          </div>
        }
      >
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading...</p>
        ) : (
          <>
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Custodian</TableHead>
                <TableHead>Owner Dept.</TableHead>
                <TableHead>Date Stored</TableHead>
                <TableHead>Disposal Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((item) => {
                const isStored = item.status === "STORED";
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{item.description}</p>
                      <p className="text-xs text-[var(--color-muted)]">{ITEM_TYPE_OPTIONS.find((o) => o.value === item.itemType)?.label} · Qty {item.quantity}</p>
                    </TableCell>
                    <TableCell>
                      {item.location?.warehouse?.name} — {item.location?.name}
                    </TableCell>
                    <TableCell>{item.custodian?.fullname ?? "-"}</TableCell>
                    <TableCell>{item.ownerDepartment?.name ?? "-"}</TableCell>
                    <TableCell>{item.dateStored?.slice(0, 10)}</TableCell>
                    <TableCell>{item.disposalDueDate?.slice(0, 10) ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isStored && <IconButton icon={Pencil} title="Edit" onClick={() => openEdit(item)} />}
                        {isStored && (
                          <IconButton icon={PackageOpen} title="Retrieve" onClick={() => retrieveMutation.mutate(item)} disabled={retrieveMutation.isPending} />
                        )}
                        {item.status !== "DISPOSED" && (
                          <IconButton icon={Archive} title="Dispose" onClick={() => handleDispose(item)} disabled={disposeMutation.isPending} />
                        )}
                        <IconButton icon={Trash2} title="Delete" variant="danger" onClick={() => handleDelete(item)} disabled={deleteMutation.isPending} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-400">
                    No storage items found
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
