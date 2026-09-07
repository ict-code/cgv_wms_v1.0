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
import { useDepartments, useEmployees, useItems, useLocations, useWarehouses } from "@/hooks/use-reference-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { BarcodeScannerDialog } from "@/components/scan/barcode-scanner-dialog";

const schema = z.object({
  requestingDepartmentId: z.string().min(1, "Required"),
  employeeId: z.string().min(1, "Required"),
  warehouseId: z.string().min(1, "Required"),
  purpose: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, "Required"),
        quantityRequested: z.coerce.number().positive("Must be positive"),
        locationId: z.string().min(1, "Required"),
      }),
    )
    .min(1, "Add at least one item"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export function IssuanceCreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [scanTargetIndex, setScanTargetIndex] = useState<number | null>(null);
  const { data: departments } = useDepartments();
  const { data: warehouses } = useWarehouses();
  const { data: items } = useItems();

  const { register, control, handleSubmit, watch, setValue } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ itemId: "", quantityRequested: 1, locationId: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const warehouseId = watch("warehouseId");
  const requestingDepartmentId = watch("requestingDepartmentId");
  const { data: locations } = useLocations(warehouseId);
  const { data: employees } = useEmployees(requestingDepartmentId || undefined);

  function handleScanDetect(code: string) {
    const index = scanTargetIndex;
    setScanTargetIndex(null);
    if (index === null) return;
    const match = items?.data.find((i) => i.barcode?.toLowerCase() === code.toLowerCase() || i.itemCode.toLowerCase() === code.toLowerCase());
    if (match) {
      setValue(`items.${index}.itemId`, match.id, { shouldValidate: true });
    } else {
      setError(`No item matches scanned code "${code}"`);
    }
  }

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => (await apiClient.post("/issuances", values)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/issuances"] });
      onClose();
      router.push(`/issuance/${data.id}`);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to create") : "Failed to create";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>Requesting Department *</Label>
          <Controller
            control={control}
            name="requestingDepartmentId"
            render={({ field }) => (
              <Combobox
                value={field.value}
                onChange={field.onChange}
                placeholder="Select department"
                options={departments?.data.map((d) => ({ value: d.id, label: d.name })) ?? []}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Issued To (Employee) *</Label>
          <Controller
            control={control}
            name="employeeId"
            render={({ field }) => (
              <Combobox
                value={field.value}
                onChange={field.onChange}
                placeholder="Select employee"
                options={employees?.data.map((e) => ({ value: e.id, label: e.fullname, description: e.employeeCode })) ?? []}
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
          <Label>Purpose</Label>
          <Input {...register("purpose")} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Items</p>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: "", quantityRequested: 1, locationId: "" })}>
            Add line
          </Button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-6">
            <div className="sm:col-span-3">
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
              <Label>Qty Requested</Label>
              <Input type="number" step="any" {...register(`items.${index}.quantityRequested`)} />
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
          {createMutation.isPending ? "Submitting..." : "Submit Request"}
        </Button>
      </div>

      <BarcodeScannerDialog open={scanTargetIndex !== null} onClose={() => setScanTargetIndex(null)} onDetect={handleScanDetect} />
    </form>
  );
}
