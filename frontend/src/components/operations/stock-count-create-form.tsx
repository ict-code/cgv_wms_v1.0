"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import Search from "@mui/icons-material/SearchRounded";
import { apiClient } from "@/lib/api-client";
import { useItems, useLocations, useWarehouses } from "@/hooks/use-reference-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

const schema = z.object({
  warehouseId: z.string().min(1, "Required"),
  locationId: z.string().min(1, "Required"),
  remarks: z.string().optional(),
  itemIds: z.array(z.string()).min(1, "Select at least one item"),
});
type FormValues = z.infer<typeof schema>;

export function StockCountCreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const { data: warehouses } = useWarehouses();
  const { data: items } = useItems();

  const { register, control, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { itemIds: [] },
  });
  const warehouseId = watch("warehouseId");
  const { data: locations } = useLocations(warehouseId);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items?.data ?? [];
    return (items?.data ?? []).filter((item) => item.name.toLowerCase().includes(q) || item.itemCode.toLowerCase().includes(q));
  }, [items, itemSearch]);

  function toggleItem(itemId: string) {
    const next = selectedItems.includes(itemId) ? selectedItems.filter((id) => id !== itemId) : [...selectedItems, itemId];
    setSelectedItems(next);
    setValue("itemIds", next, { shouldValidate: true });
  }

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => (await apiClient.post("/stock-counts", values)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/stock-counts"] });
      onClose();
      router.push(`/stock-counts/${data.id}`);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to create") : "Failed to create";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>Warehouse *</Label>
          <Controller
            control={control}
            name="warehouseId"
            render={({ field }) => (
              <Combobox
                value={field.value}
                onChange={field.onChange}
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
          <Label>Remarks</Label>
          <Input {...register("remarks")} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Items to count ({selectedItems.length} selected)</p>
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--color-border)]">
          {filteredItems.map((item) => (
            <label key={item.id} className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-sm last:border-0 hover:bg-slate-50">
              <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleItem(item.id)} />
              <span className="font-medium">{item.itemCode}</span>
              <span className="text-[var(--color-muted)]">{item.name}</span>
            </label>
          ))}
          {filteredItems.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No items match your search</p>}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Stock Count"}
        </Button>
      </div>
    </form>
  );
}
