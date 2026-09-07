"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ReturnDoc } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowActions } from "@/components/operations/workflow-actions";
import { formatDateTime, formatQuantity } from "@/lib/utils";

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: [`/returns/${id}`],
    queryFn: async () => (await apiClient.get<ReturnDoc>(`/returns/${id}`)).data,
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{data.returnNo}</h1>
          <p className="text-sm text-slate-500">Created {formatDateTime(data.createdAt)}</p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Department</p>
            <p className="font-medium">{data.department?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Warehouse</p>
            <p className="font-medium">{data.warehouse?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Reason</p>
            <p className="font-medium">{data.reason ?? "-"}</p>
          </div>
        </CardContent>
      </Card>

      {data.status === "DRAFT" && (
        <WorkflowActions
          endpoint="/returns"
          id={id}
          actions={[
            { label: "Post Return", action: "receive", confirm: "Post this return to inventory?" },
            { label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel this return?" },
          ]}
        />
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
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
              <TableCell>{formatQuantity(line.quantity)}</TableCell>
              <TableCell>{line.location?.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
