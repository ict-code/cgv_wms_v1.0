"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import type { StockCount } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowActions, type WorkflowAction } from "@/components/operations/workflow-actions";
import { formatDateTime, formatQuantity } from "@/lib/utils";

export default function StockCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [physicalQuantities, setPhysicalQuantities] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [`/stock-counts/${id}`],
    queryFn: async () => (await apiClient.get<StockCount>(`/stock-counts/${id}`)).data,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const items = data!.items.map((line) => ({
        stockCountItemId: line.id,
        physicalQuantity: Number(physicalQuantities[line.id] ?? line.physicalQuantity),
      }));
      return (await apiClient.post(`/stock-counts/${id}/submit`, { items })).data;
    },
    onSuccess: () => {
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: [`/stock-counts/${id}`] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to submit count") : "Failed to submit";
      setSubmitError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading...</p>;

  const actions: WorkflowAction[] = [];
  if (data.status === "DRAFT") actions.push({ label: "Start Count", action: "start", confirm: "Start counting? This snapshots current system quantities." });
  if (data.status === "SUBMITTED") actions.push({ label: "Mark Reviewed", action: "review", confirm: "Mark this count as reviewed?" });
  if (data.status === "REVIEWED")
    actions.push({ label: "Approve & Post Corrections", action: "approve", confirm: "Approve and post inventory corrections for any variance?" });
  if (["DRAFT", "IN_PROGRESS", "SUBMITTED", "REVIEWED"].includes(data.status))
    actions.push({ label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel this stock count?" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{data.countNo}</h1>
          <p className="text-sm text-slate-500">Created {formatDateTime(data.createdAt)}</p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Warehouse</p>
            <p className="font-medium">{data.warehouse?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Location</p>
            <p className="font-medium">{data.location?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Started</p>
            <p className="font-medium">{data.startedAt ? formatDateTime(data.startedAt) : "-"}</p>
          </div>
          <div>
            <p className="text-slate-500">Completed</p>
            <p className="font-medium">{data.completedAt ? formatDateTime(data.completedAt) : "-"}</p>
          </div>
        </CardContent>
      </Card>

      <WorkflowActions endpoint="/stock-counts" id={id} actions={actions} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>System Qty</TableHead>
            <TableHead>Physical Qty</TableHead>
            <TableHead>Variance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                <p className="font-medium">{line.item?.name}</p>
                <p className="text-xs text-slate-500">{line.item?.itemCode}</p>
              </TableCell>
              <TableCell>{formatQuantity(line.systemQuantity)}</TableCell>
              <TableCell>
                {data.status === "IN_PROGRESS" ? (
                  <Input
                    type="number"
                    step="any"
                    className="w-28"
                    defaultValue={line.physicalQuantity}
                    onChange={(e) => setPhysicalQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))}
                  />
                ) : (
                  formatQuantity(line.physicalQuantity)
                )}
              </TableCell>
              <TableCell className={Number(line.variance) !== 0 ? "font-medium text-amber-600" : ""}>{formatQuantity(line.variance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data.status === "IN_PROGRESS" && (
        <div className="flex flex-col gap-2">
          <div>
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Submitting..." : "Submit Count"}
            </Button>
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        </div>
      )}
    </div>
  );
}
