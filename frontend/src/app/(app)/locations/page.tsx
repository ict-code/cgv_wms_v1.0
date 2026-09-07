"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import Pencil from "@mui/icons-material/EditRounded";
import Power from "@mui/icons-material/PowerSettingsNewRounded";
import Trash2 from "@mui/icons-material/DeleteRounded";
import { apiClient } from "@/lib/api-client";
import type { Location, LocationType, Paginated, Warehouse } from "@/lib/types";
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

const LOCATION_TYPES: LocationType[] = ["ZONE", "RACK", "SHELF", "BIN", "FLOOR", "STAGING", "RECEIVING", "DISPATCH", "QUARANTINE"];

const schema = z.object({
  warehouseId: z.string().min(1, "Required"),
  parentLocationId: z.string().optional().or(z.literal("")),
  code: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  locationType: z.enum(LOCATION_TYPES as [LocationType, ...LocationType[]]),
});
type FormValues = z.infer<typeof schema>;

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [editingLocation, setEditingLocation] = useState<Location | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { register, control, handleSubmit, reset, watch } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const isOpen = editingLocation !== undefined;
  const formWarehouseId = watch("warehouseId");

  const { data: warehouses } = useQuery({
    queryKey: ["/warehouses"],
    queryFn: async () => (await apiClient.get<Paginated<Warehouse>>("/warehouses", { params: { pageSize: 100 } })).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/locations"],
    queryFn: async () => (await apiClient.get<Paginated<Location>>("/locations", { params: { pageSize: 200 } })).data,
  });

  function warehouseName(id: string) {
    return warehouses?.data.find((w) => w.id === id)?.name ?? id;
  }

  function locationName(id: string | null) {
    if (!id) return "-";
    return data?.data.find((l) => l.id === id)?.name ?? "-";
  }

  const parentOptions = useMemo(
    () =>
      (data?.data ?? [])
        .filter((l) => l.warehouseId === formWarehouseId && l.id !== editingLocation?.id)
        .map((l) => ({ value: l.id, label: l.name, description: l.code })),
    [data, formWarehouseId, editingLocation],
  );

  const filtered = useMemo(() => {
    let rows = data?.data ?? [];
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    if (warehouseFilter) rows = rows.filter((r) => r.warehouseId === warehouseFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    }
    return rows;
  }, [data, search, statusFilter, warehouseFilter]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, `${search}|${statusFilter}|${warehouseFilter}`);

  function openCreate() {
    reset({ warehouseId: "", parentLocationId: "", code: "", name: "", locationType: "ZONE" });
    setError(null);
    setEditingLocation(null);
  }

  function openEdit(loc: Location) {
    reset({
      warehouseId: loc.warehouseId,
      parentLocationId: loc.parentLocationId ?? "",
      code: loc.code,
      name: loc.name,
      locationType: loc.locationType,
    });
    setError(null);
    setEditingLocation(loc);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, parentLocationId: values.parentLocationId || undefined };
      if (editingLocation) return (await apiClient.patch(`/locations/${editingLocation.id}`, payload)).data;
      return (await apiClient.post("/locations", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/locations"] });
      setEditingLocation(undefined);
      setError(null);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to save") : "Failed to save";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (loc: Location) => {
      await apiClient.patch(`/locations/${loc.id}`, { status: loc.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/locations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (loc: Location) => {
      await apiClient.delete(`/locations/${loc.id}`);
    },
    onSuccess: (_data, loc) => {
      setActionError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(loc.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/locations"] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to delete") : "Failed to delete";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  function handleDelete(loc: Location) {
    if (!window.confirm("Delete this location? This cannot be undone.")) return;
    deleteMutation.mutate(loc);
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selected.size} selected location(s)? This cannot be undone.`)) return;
    setActionError(null);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/locations/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) setActionError(`${failed} of ${ids.length} could not be deleted (still referenced elsewhere).`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["/locations"] });
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
        <h1 className="text-2xl font-bold text-foreground">Locations</h1>
        <div className="flex items-center gap-2">
          <ImportExportBar endpoint="/locations" resourceName="locations" onImported={() => queryClient.invalidateQueries({ queryKey: ["/locations"] })} />
          <Button onClick={openCreate}>New Location</Button>
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

      <Dialog open={isOpen} onClose={() => setEditingLocation(undefined)} title={editingLocation ? "Edit Location" : "New Location"}>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="warehouseId">Warehouse *</Label>
            <Controller
              control={control}
              name="warehouseId"
              render={({ field }) => (
                <Combobox
                  id="warehouseId"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select warehouse"
                  options={warehouses?.data.map((w) => ({ value: w.id, label: w.name })) ?? []}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="parentLocationId">Parent Location</Label>
            <Controller
              control={control}
              name="parentLocationId"
              render={({ field }) => (
                <Combobox
                  id="parentLocationId"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select parent location"
                  emptyOptionLabel="None (top-level)"
                  disabled={!formWarehouseId}
                  options={parentOptions}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="locationType">Type *</Label>
            <Select id="locationType" {...register("locationType")}>
              {LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Code *</Label>
            <Input id="code" {...register("code")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} />
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
        title="Locations"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search locations..."
        filterActive={statusFilter !== "ALL" || !!warehouseFilter}
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
              <Label className="text-xs">Warehouse</Label>
              <Select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                <option value="">All</option>
                {warehouses?.data.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
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
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Parent Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-[#206bc4]"
                      checked={selected.has(loc.id)}
                      onChange={() => toggleRow(loc.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={loc.name} />
                      <div>
                        <p className="font-medium text-foreground">{loc.name}</p>
                        <p className="text-xs text-[var(--color-muted)]">{loc.code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{loc.locationType}</TableCell>
                  <TableCell>{warehouseName(loc.warehouseId)}</TableCell>
                  <TableCell>{locationName(loc.parentLocationId)}</TableCell>
                  <TableCell>
                    <StatusBadge status={loc.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton icon={Pencil} title="Edit" onClick={() => openEdit(loc)} />
                      <IconButton
                        icon={Power}
                        title={loc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        onClick={() => toggleStatusMutation.mutate(loc)}
                        disabled={toggleStatusMutation.isPending}
                      />
                      <IconButton icon={Trash2} title="Delete" variant="danger" onClick={() => handleDelete(loc)} disabled={deleteMutation.isPending} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    No locations found
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
