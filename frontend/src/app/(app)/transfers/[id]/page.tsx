"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Transfer } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowActions, type WorkflowAction } from "@/components/operations/workflow-actions";
import { formatDateTime, formatQuantity } from "@/lib/utils";

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: [`/transfers/${id}`],
    queryFn: async () => (await apiClient.get<Transfer>(`/transfers/${id}`)).data,
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading...</p>;

  const actions: WorkflowAction[] = [];
  if (data.status === "PENDING_APPROVAL") {
    actions.push({ label: "Approve", action: "approve", confirm: "Approve this transfer?" });
    actions.push({ label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel this transfer?" });
  }
  if (data.status === "APPROVED") {
    actions.push({ label: "Execute Transfer", action: "execute", confirm: "Move stock between locations now?" });
    actions.push({ label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel this transfer?" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{data.transferNo}</h1>
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
            <p className="text-slate-500">From</p>
            <p className="font-medium">{data.fromLocation?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">To</p>
            <p className="font-medium">{data.toLocation?.name}</p>
          </div>
        </CardContent>
      </Card>

      <WorkflowActions endpoint="/transfers" id={id} actions={actions} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                <p className="font-medium">{line.item?.name}</p>
                <p className="text-xs text-slate-500">{line.item?.itemCode}</p>
              </TableCell>
              <TableCell>{formatQuantity(line.quantity)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
