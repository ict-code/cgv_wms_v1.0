"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import { useItems, useLocations, useWarehouses } from "@/hooks/use-reference-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";

const REASONS = ["DAMAGED", "LOST", "FOUND", "COUNTING_DISCREPANCY", "DATA_CORRECTION", "EXPIRED", "OTHER"] as const;
const DIRECTIONS = ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] as const;

const schema = z.object({
  warehouseId: z.string().min(1, "Required"),
  reason: z.enum(REASONS),
  remarks: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, "Required"),
        locationId: z.string().min(1, "Required"),
        quantity: z.coerce.number().positive("Must be positive"),
        adjustmentType: z.enum(DIRECTIONS),
      }),
    )
    .min(1, "Add at least one item"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export function AdjustmentCreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: warehouses } = useWarehouses();
  const { data: items } = useItems();

  const { register, control, handleSubmit, watch } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ itemId: "", locationId: "", quantity: 1, adjustmentType: "ADJUSTMENT_OUT" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const warehouseId = watch("warehouseId");
  const { data: locations } = useLocations(warehouseId);

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => (await apiClient.post("/adjustments", values)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/adjustments"] });
      onClose();
      router.push(`/adjustments/${data.id}`);
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
          <Label>Reason *</Label>
          <Select {...register("reason")}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Remarks</Label>
          <Input {...register("remarks")} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Items</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ itemId: "", locationId: "", quantity: 1, adjustmentType: "ADJUSTMENT_OUT" })}
          >
            Add line
          </Button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Label>Item</Label>
              <Controller
                control={control}
                name={`items.${index}.itemId`}
                render={({ field }) => (
                  <Combobox
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select item"
                    options={items?.data.map((i) => ({ value: i.id, label: i.name, description: i.itemCode })) ?? []}
                  />
                )}
              />
            </div>
            <div>
              <Label>Direction</Label>
              <Select {...register(`items.${index}.adjustmentType`)}>
                <option value="ADJUSTMENT_IN">Increase</option>
                <option value="ADJUSTMENT_OUT">Decrease</option>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" step="any" {...register(`items.${index}.quantity`)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Location</Label>
              <Controller
                control={control}
                name={`items.${index}.locationId`}
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
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length === 1}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Adjustment"}
        </Button>
      </div>
    </form>
  );
}
