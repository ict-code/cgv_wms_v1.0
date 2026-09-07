"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Receiving } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowActions } from "@/components/operations/workflow-actions";
import { formatCurrency, formatDateTime, formatQuantity } from "@/lib/utils";

export default function ReceivingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: [`/receivings/${id}`],
    queryFn: async () => (await apiClient.get<Receiving>(`/receivings/${id}`)).data,
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{data.receivingNo}</h1>
          <p className="text-sm text-slate-500">Created {formatDateTime(data.createdAt)}</p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Supplier</p>
            <p className="font-medium">{data.supplier?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Warehouse</p>
            <p className="font-medium">{data.warehouse?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Purchase Ref.</p>
            <p className="font-medium">{data.purchaseReference ?? "-"}</p>
          </div>
          <div>
            <p className="text-slate-500">Received At</p>
            <p className="font-medium">{data.receivedAt ? formatDateTime(data.receivedAt) : "-"}</p>
          </div>
        </CardContent>
      </Card>

      {data.status === "PENDING" && (
        <WorkflowActions
          endpoint="/receivings"
          id={id}
          actions={[
            { label: "Post Receiving", action: "receive", confirm: "Post this receiving to inventory?" },
            { label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel this receiving?" },
          ]}
        />
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit Cost</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Batch/Serial</TableHead>
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
              <TableCell>{formatCurrency(line.unitCost)}</TableCell>
              <TableCell>{line.location?.name}</TableCell>
              <TableCell>{line.batchNo ?? line.serialNo ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
