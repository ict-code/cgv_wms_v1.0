"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ScanLine } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useItems, useLocations, useSuppliers, useWarehouses } from "@/hooks/use-reference-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { BarcodeScannerDialog } from "@/components/scan/barcode-scanner-dialog";

const lineSchema = z.object({
  itemId: z.string().min(1, "Required"),
  quantity: z.coerce.number().positive("Must be positive"),
  unitCost: z.coerce.number().min(0),
  locationId: z.string().min(1, "Required"),
  batchNo: z.string().optional(),
  serialNo: z.string().optional(),
  expiryDate: z.string().optional(),
});

const schema = z.object({
  supplierId: z.string().min(1, "Required"),
  warehouseId: z.string().min(1, "Required"),
  purchaseReference: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(lineSchema).min(1, "Add at least one item"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export function ReceivingCreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [scanTargetIndex, setScanTargetIndex] = useState<number | null>(null);
  const { data: suppliers } = useSuppliers();
  const { data: warehouses } = useWarehouses();
  const { data: items } = useItems();

  const { register, control, handleSubmit, watch, setValue } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ itemId: "", quantity: 1, unitCost: 0, locationId: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const warehouseId = watch("warehouseId");
  const { data: locations } = useLocations(warehouseId);

  function handleScanDetect(code: string) {
    const index = scanTargetIndex;
    setScanTargetIndex(null);
    if (index === null) return;
    const match = items?.data.find((i) => i.barcode?.toLowerCase() === code.toLowerCase() || i.itemCode.toLowerCase() === code.toLowerCase());
    if (match) {
      setValue(`items.${index}.itemId`, match.id, { shouldValidate: true });
      setValue(`items.${index}.unitCost`, Number(match.standardCost), { shouldValidate: true });
    } else {
      setError(`No item matches scanned code "${code}"`);
    }
  }

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => (await apiClient.post("/receivings", values)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/receivings"] });
      onClose();
      router.push(`/receiving/${data.id}`);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to create receiving") : "Failed to create";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>Supplier *</Label>
          <Controller
            control={control}
            name="supplierId"
            render={({ field }) => (
              <Combobox
                value={field.value}
                onChange={field.onChange}
                placeholder="Select supplier"
                options={suppliers?.data.map((s) => ({ value: s.id, label: s.name })) ?? []}
              />
            )}
          />
        </div>
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
          <Label>Purchase Reference</Label>
          <Input {...register("purchaseReference")} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Items</p>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: "", quantity: 1, unitCost: 0, locationId: "" })}>
            Add line
          </Button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Label>Item</Label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1">
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
                <Button type="button" variant="outline" size="sm" title="Scan barcode" onClick={() => setScanTargetIndex(index)}>
                  <ScanLine className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" step="any" {...register(`items.${index}.quantity`)} />
            </div>
            <div>
              <Label>Unit Cost</Label>
              <Input type="number" step="any" {...register(`items.${index}.unitCost`)} />
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
          {createMutation.isPending ? "Creating..." : "Create Receiving"}
        </Button>
      </div>

      <BarcodeScannerDialog open={scanTargetIndex !== null} onClose={() => setScanTargetIndex(null)} onDetect={handleScanDetect} />
    </form>
  );
}
