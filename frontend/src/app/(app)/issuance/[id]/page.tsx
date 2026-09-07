"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Issuance } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowActions, type WorkflowAction } from "@/components/operations/workflow-actions";
import { formatDateTime, formatQuantity } from "@/lib/utils";

export default function IssuanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: [`/issuances/${id}`],
    queryFn: async () => (await apiClient.get<Issuance>(`/issuances/${id}`)).data,
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading...</p>;

  const actions: WorkflowAction[] = [];
  if (data.status === "PENDING_APPROVAL") {
    actions.push({ label: "Approve", action: "approve", confirm: "Approve and reserve stock for this request?" });
    actions.push({ label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel this request?" });
  }
  if (data.status === "APPROVED") {
    actions.push({ label: "Post Issuance", action: "issue", confirm: "Post this issuance and release the goods?" });
    actions.push({ label: "Cancel", action: "cancel", variant: "destructive", confirm: "Cancel and release the reservation?" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{data.issuanceNo}</h1>
          <p className="text-sm text-slate-500">Created {formatDateTime(data.createdAt)}</p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Department</p>
            <p className="font-medium">{data.requestingDepartment?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Issued To</p>
            <p className="font-medium">{data.employee?.fullname ?? "-"}</p>
          </div>
          <div>
            <p className="text-slate-500">Warehouse</p>
            <p className="font-medium">{data.warehouse?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Purpose</p>
            <p className="font-medium">{data.purpose ?? "-"}</p>
          </div>
        </CardContent>
      </Card>

      <WorkflowActions endpoint="/issuances" id={id} actions={actions} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Qty Requested</TableHead>
            <TableHead>Qty Issued</TableHead>
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
              <TableCell>{formatQuantity(line.quantityRequested)}</TableCell>
              <TableCell>{line.quantityIssued ? formatQuantity(line.quantityIssued) : "-"}</TableCell>
              <TableCell>{line.location?.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
