"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Adjustment } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowActions, type WorkflowAction } from "@/components/operations/workflow-actions";
import { formatDateTime, formatQuantity } from "@/lib/utils";

export default function AdjustmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: [`/adjustments/${id}`],
    queryFn: async () => (await apiClient.get<Adjustment>(`/adjustments/${id}`)).data,
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading...</p>;

  const actions: WorkflowAction[] = [];
  if (data.status === "PENDING_APPROVAL") {
    actions.push({ label: "Approve", action: "approve", confirm: "Approve this adjustment?" });
    actions.push({ label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel this adjustment?" });
  }
  if (data.status === "APPROVED") {
    actions.push({ label: "Post Adjustment", action: "post", confirm: "Post this adjustment to inventory?" });
    actions.push({ label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel this adjustment?" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{data.adjustmentNo}</h1>
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
            <p className="text-slate-500">Reason</p>
            <p className="font-medium">{data.reason.replaceAll("_", " ")}</p>
          </div>
          <div>
            <p className="text-slate-500">Remarks</p>
            <p className="font-medium">{data.remarks ?? "-"}</p>
          </div>
        </CardContent>
      </Card>

      <WorkflowActions endpoint="/adjustments" id={id} actions={actions} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Location</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                <p className="font-medium">{line.item?.name}</p>
                <p className="text-xs text-slate-500">{line.item?.itemCode}</p>
              </TableCell>
              <TableCell>{line.adjustmentType === "ADJUSTMENT_IN" ? "Increase" : "Decrease"}</TableCell>
              <TableCell>{formatQuantity(line.quantity)}</TableCell>
              <TableCell>{line.location?.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
