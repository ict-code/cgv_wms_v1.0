"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, PackageX, Timer } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { DashboardData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatQuantity } from "@/lib/utils";

async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await apiClient.get("/reports/dashboard");
  return data;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  if (isLoading || !data) {
    return <p className="text-sm text-[var(--color-muted)]">Loading dashboard...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Overview</p>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Items" value={data.inventory.totalItems} />
        <StatCard label="Total Quantity" value={formatQuantity(data.inventory.totalQuantity)} />
        <StatCard
          label="Low Stock"
          value={data.inventory.lowStockCount}
          alert={data.inventory.lowStockCount > 0}
          icon={AlertTriangle}
        />
        <StatCard
          label="Out of Stock"
          value={data.inventory.outOfStockCount}
          alert={data.inventory.outOfStockCount > 0}
          icon={PackageX}
        />
        <StatCard
          label="Expiring Soon"
          value={data.inventory.expiringCount}
          alert={data.inventory.expiringCount > 0}
          icon={Timer}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 py-3">
          <PendingStat label="Pending Receiving" value={data.operations.pendingReceiving} />
          <PendingStat label="Pending Issuance" value={data.operations.pendingIssuance} />
          <PendingStat label="Pending Approvals" value={data.operations.pendingApprovals} />
          <PendingStat label="Pending Stock Counts" value={data.operations.pendingStockCounts} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <ActivityCard title="Recently Received" transactions={data.inventory.recentlyReceived} />
        <ActivityCard title="Recently Issued" transactions={data.inventory.recentlyIssued} />
        <ActivityCard title="Recent Adjustments" transactions={data.inventory.recentAdjustments} />
        <TransfersCard transfers={data.operations.recentTransfers} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  alert,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
  icon?: typeof AlertTriangle;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-0">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {Icon && (
          <Badge variant={alert ? "warning" : "success"} className="gap-1">
            {alert ? <Icon className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {alert ? "Attention" : "Clear"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function PendingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-lg font-bold ${value > 0 ? "text-brand-500" : "text-foreground"}`}>{value}</span>
      <span className="text-sm text-[var(--color-muted)]">{label}</span>
    </div>
  );
}

function ActivityCard({ title, transactions }: { title: string; transactions: DashboardData["inventory"]["recentlyReceived"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400">No recent activity</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex justify-between text-sm">
                <span className="truncate text-foreground">{tx.item?.name ?? tx.itemId}</span>
                <span className="text-[var(--color-muted)]">{formatQuantity(tx.quantity)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TransfersCard({ transfers }: { transfers: DashboardData["operations"]["recentTransfers"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transfers</CardTitle>
      </CardHeader>
      <CardContent>
        {transfers.length === 0 ? (
          <p className="text-sm text-slate-400">No recent activity</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transfers.map((t) => (
              <li key={t.id} className="flex justify-between text-sm">
                <span className="truncate text-foreground">
                  {t.fromLocation?.name} → {t.toLocation?.name}
                </span>
                <span className="text-[var(--color-muted)]">{t.transferNo}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
