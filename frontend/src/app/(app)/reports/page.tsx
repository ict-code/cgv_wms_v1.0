"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FileDown from "@mui/icons-material/FileDownloadRounded";
import FileSpreadsheet from "@mui/icons-material/TableChartRounded";
import FileText from "@mui/icons-material/DescriptionRounded";
import { apiClient } from "@/lib/api-client";
import type { InventoryBalance, InventoryTransaction } from "@/lib/types";
import { useWarehouses } from "@/hooks/use-reference-data";
import { usePagination } from "@/hooks/use-pagination";
import { downloadFile } from "@/lib/download";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { cn, formatCurrency, formatDateTime, formatQuantity } from "@/lib/utils";

const TRANSACTION_TYPES = ["RECEIVE", "ISSUE", "TRANSFER_OUT", "TRANSFER_IN", "RETURN", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "STOCK_COUNT"];

type ReportKey =
  | "current-inventory"
  | "low-stock"
  | "out-of-stock"
  | "expiring"
  | "transactions"
  | "issuances-by-department"
  | "issuances-by-employee"
  | "stock-count-variance";

const REPORT_GROUPS: { group: string; items: { key: ReportKey; label: string }[] }[] = [
  {
    group: "Inventory",
    items: [
      { key: "current-inventory", label: "Current Inventory" },
      { key: "low-stock", label: "Low Stock" },
      { key: "out-of-stock", label: "Out of Stock" },
      { key: "expiring", label: "Expiring" },
    ],
  },
  {
    group: "Transactions",
    items: [{ key: "transactions", label: "Transaction Ledger" }],
  },
  {
    group: "Accountability",
    items: [
      { key: "issuances-by-department", label: "Issuance by Department" },
      { key: "issuances-by-employee", label: "Issuance by Employee" },
    ],
  },
  {
    group: "Physical Inventory",
    items: [{ key: "stock-count-variance", label: "Stock Count Variance" }],
  },
];

function ExportButtons({ reportKey, filters }: { reportKey: ReportKey; filters: Record<string, string | undefined> }) {
  function buildUrl(format: string) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    return `/reports/${reportKey}/export/${format}${qs ? `?${qs}` : ""}`;
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" onClick={() => downloadFile(buildUrl("csv"), `${reportKey}.csv`)}>
        <FileText className="h-3.5 w-3.5" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadFile(buildUrl("xlsx"), `${reportKey}.xlsx`)}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadFile(buildUrl("pdf"), `${reportKey}.pdf`)}>
        <FileDown className="h-3.5 w-3.5" />
        PDF
      </Button>
    </div>
  );
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportKey>("current-inventory");
  const [warehouseId, setWarehouseId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [search, setSearch] = useState("");

  const { data: warehouses } = useWarehouses();

  const { data: lowStockSummary } = useQuery({
    queryKey: ["/reports/inventory/low-stock", "summary"],
    queryFn: async () => (await apiClient.get("/reports/inventory/low-stock")).data,
  });
  const { data: expiringSummary } = useQuery({
    queryKey: ["/reports/inventory/expiring", "summary"],
    queryFn: async () => (await apiClient.get<InventoryTransaction[]>("/reports/inventory/expiring")).data,
  });

  const commonFilters = { warehouseId: warehouseId || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

  const currentInventoryQuery = useQuery({
    queryKey: ["/reports/inventory/current", warehouseId],
    queryFn: async () => (await apiClient.get<InventoryBalance[]>("/reports/inventory/current", { params: { warehouseId: warehouseId || undefined } })).data,
    enabled: activeReport === "current-inventory",
  });
  const lowStockQuery = useQuery({
    queryKey: ["/reports/inventory/low-stock", warehouseId],
    queryFn: async () =>
      (await apiClient.get<{ item: { id: string; itemCode: string; name: string; reorderLevel: string }; totalAvailable: string }[]>(
        "/reports/inventory/low-stock",
        { params: { warehouseId: warehouseId || undefined } },
      )).data,
    enabled: activeReport === "low-stock",
  });
  const outOfStockQuery = useQuery({
    queryKey: ["/reports/inventory/out-of-stock", warehouseId],
    queryFn: async () =>
      (await apiClient.get<{ item: { id: string; itemCode: string; name: string; reorderLevel: string }; totalAvailable: string }[]>(
        "/reports/inventory/out-of-stock",
        { params: { warehouseId: warehouseId || undefined } },
      )).data,
    enabled: activeReport === "out-of-stock",
  });
  const expiringQuery = useQuery({
    queryKey: ["/reports/inventory/expiring", warehouseId],
    queryFn: async () => (await apiClient.get<InventoryTransaction[]>("/reports/inventory/expiring", { params: { warehouseId: warehouseId || undefined } })).data,
    enabled: activeReport === "expiring",
  });
  const transactionsQuery = useQuery({
    queryKey: ["/reports/transactions", transactionType, warehouseId, dateFrom, dateTo],
    queryFn: async () =>
      (await apiClient.get("/reports/transactions", {
        params: { transactionType: transactionType || undefined, ...commonFilters, pageSize: 200 },
      })).data,
    enabled: activeReport === "transactions",
  });
  const issuancesByDeptQuery = useQuery({
    queryKey: ["/reports/issuances-by-department", warehouseId, dateFrom, dateTo],
    queryFn: async () =>
      (await apiClient.get<{ department: { id: string; name: string } | null; issuanceCount: number; totalValue: string }[]>(
        "/reports/issuances-by-department",
        { params: commonFilters },
      )).data,
    enabled: activeReport === "issuances-by-department",
  });
  const issuancesByEmpQuery = useQuery({
    queryKey: ["/reports/issuances-by-employee", warehouseId, dateFrom, dateTo],
    queryFn: async () =>
      (await apiClient.get<{ employee: { id: string; fullname: string; employeeCode: string } | null; issuanceCount: number; totalValue: string }[]>(
        "/reports/issuances-by-employee",
        { params: commonFilters },
      )).data,
    enabled: activeReport === "issuances-by-employee",
  });
  const stockCountVarianceQuery = useQuery({
    queryKey: ["/reports/stock-counts/variance"],
    queryFn: async () =>
      (await apiClient.get<
        { id: string; item: { name: string; itemCode: string }; systemQuantity: string; physicalQuantity: string; variance: string; stockCount: { countNo: string; warehouse: { name: string } } }[]
      >("/reports/stock-counts/variance")).data,
    enabled: activeReport === "stock-count-variance",
  });

  const filteredTransactions = useMemo(() => {
    let rows: InventoryTransaction[] = transactionsQuery.data?.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((tx) => tx.transactionNo.toLowerCase().includes(q) || tx.item?.name.toLowerCase().includes(q));
    }
    return rows;
  }, [transactionsQuery.data, search]);
  const txPagination = usePagination(filteredTransactions, `${search}|${transactionType}|${warehouseId}|${dateFrom}|${dateTo}`);

  const currentInventoryPagination = usePagination(currentInventoryQuery.data ?? [], `${warehouseId}`);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Reports</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low Stock ({lowStockSummary?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!lowStockSummary || lowStockSummary.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing below reorder level</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {lowStockSummary.map((entry: { item: { id: string; name: string }; totalAvailable: string }) => (
                  <li key={entry.item.id} className="flex justify-between">
                    <span>{entry.item.name}</span>
                    <span className="text-amber-600">{formatQuantity(entry.totalAvailable)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiring Soon ({expiringSummary?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!expiringSummary || expiringSummary.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing expiring within 30 days</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {expiringSummary.map((tx) => (
                  <li key={tx.id} className="flex justify-between">
                    <span>{tx.item?.name}</span>
                    <span className="text-amber-600">{tx.expiryDate ? formatDateTime(tx.expiryDate) : "-"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] p-3">
          {REPORT_GROUPS.map((g) => (
            <div key={g.group} className="flex items-center gap-1 border-r border-[var(--color-border)] pr-2 last:border-0">
              <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.group}</span>
              {g.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveReport(item.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-sm font-medium",
                    activeReport === item.key ? "bg-brand-500 text-white" : "text-foreground hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--color-border)] p-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Warehouse</Label>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-48">
              <option value="">All warehouses</option>
              {warehouses?.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          {(activeReport === "transactions" || activeReport === "issuances-by-department" || activeReport === "issuances-by-employee") && (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
              </div>
            </>
          )}
          {activeReport === "transactions" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Type</Label>
              <Select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className="w-44">
                <option value="">All types</option>
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {activeReport === "transactions" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Search</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Txn number or item..." className="w-52" />
            </div>
          )}
          <div className="ml-auto">
            <ExportButtons
              reportKey={activeReport}
              filters={{
                warehouseId: warehouseId || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                transactionType: activeReport === "transactions" ? transactionType || undefined : undefined,
              }}
            />
          </div>
        </div>

        {activeReport === "current-inventory" && (
          <>
            <Table bare>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentInventoryPagination.paged.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium">{b.item?.name}</p>
                      <p className="text-xs text-slate-500">{b.item?.itemCode}</p>
                    </TableCell>
                    <TableCell>{b.item?.category?.name}</TableCell>
                    <TableCell>{b.warehouse?.name}</TableCell>
                    <TableCell>{b.location?.name}</TableCell>
                    <TableCell>{formatQuantity(b.quantity)}</TableCell>
                    <TableCell>{formatQuantity(b.reservedQuantity)}</TableCell>
                    <TableCell className="font-medium">{formatQuantity(b.availableQuantity)}</TableCell>
                  </TableRow>
                ))}
                {currentInventoryPagination.paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400">
                      No inventory records
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              page={currentInventoryPagination.page}
              pageCount={currentInventoryPagination.pageCount}
              totalItems={currentInventoryPagination.totalItems}
              pageSize={currentInventoryPagination.pageSize}
              onPageChange={currentInventoryPagination.setPage}
            />
          </>
        )}

        {(activeReport === "low-stock" || activeReport === "out-of-stock") && (
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(activeReport === "low-stock" ? lowStockQuery.data : outOfStockQuery.data)?.map((entry) => (
                <TableRow key={entry.item.id}>
                  <TableCell>
                    <p className="font-medium">{entry.item.name}</p>
                    <p className="text-xs text-slate-500">{entry.item.itemCode}</p>
                  </TableCell>
                  <TableCell>{formatQuantity(entry.item.reorderLevel)}</TableCell>
                  <TableCell className="font-medium text-amber-600">{formatQuantity(entry.totalAvailable)}</TableCell>
                </TableRow>
              ))}
              {(activeReport === "low-stock" ? lowStockQuery.data : outOfStockQuery.data)?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-400">
                    Nothing to show
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {activeReport === "expiring" && (
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiringQuery.data?.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{tx.item?.name}</TableCell>
                  <TableCell>{tx.warehouse?.name}</TableCell>
                  <TableCell>{tx.location?.name}</TableCell>
                  <TableCell>{tx.expiryDate ? formatDateTime(tx.expiryDate) : "-"}</TableCell>
                  <TableCell>{formatQuantity(tx.quantity)}</TableCell>
                </TableRow>
              ))}
              {expiringQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400">
                    Nothing expiring soon
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {activeReport === "transactions" && (
          <>
            <Table bare>
              <TableHeader>
                <TableRow>
                  <TableHead>Txn No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txPagination.paged.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.transactionNo}</TableCell>
                    <TableCell>{tx.transactionType}</TableCell>
                    <TableCell>{tx.item?.name}</TableCell>
                    <TableCell>{formatQuantity(tx.quantity)}</TableCell>
                    <TableCell>{tx.performedByUser?.fullname}</TableCell>
                    <TableCell>{formatDateTime(tx.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-400">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              page={txPagination.page}
              pageCount={txPagination.pageCount}
              totalItems={txPagination.totalItems}
              pageSize={txPagination.pageSize}
              onPageChange={txPagination.setPage}
            />
          </>
        )}

        {(activeReport === "issuances-by-department" || activeReport === "issuances-by-employee") && (
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead>{activeReport === "issuances-by-department" ? "Department" : "Employee"}</TableHead>
                <TableHead>Issuance Count</TableHead>
                <TableHead>Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeReport === "issuances-by-department"
                ? issuancesByDeptQuery.data?.map((entry, i) => (
                    <TableRow key={entry.department?.id ?? i}>
                      <TableCell>{entry.department?.name ?? "-"}</TableCell>
                      <TableCell>{entry.issuanceCount}</TableCell>
                      <TableCell>{formatCurrency(entry.totalValue)}</TableCell>
                    </TableRow>
                  ))
                : issuancesByEmpQuery.data?.map((entry, i) => (
                    <TableRow key={entry.employee?.id ?? i}>
                      <TableCell>
                        {entry.employee?.fullname ?? "-"}
                        {entry.employee?.employeeCode && <span className="ml-1 text-xs text-slate-400">({entry.employee.employeeCode})</span>}
                      </TableCell>
                      <TableCell>{entry.issuanceCount}</TableCell>
                      <TableCell>{formatCurrency(entry.totalValue)}</TableCell>
                    </TableRow>
                  ))}
              {(activeReport === "issuances-by-department" ? issuancesByDeptQuery.data : issuancesByEmpQuery.data)?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-400">
                    No issuances in range
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {activeReport === "stock-count-variance" && (
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead>Count No.</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>System Qty</TableHead>
                <TableHead>Physical Qty</TableHead>
                <TableHead>Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockCountVarianceQuery.data?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.stockCount.countNo}</TableCell>
                  <TableCell>{entry.stockCount.warehouse.name}</TableCell>
                  <TableCell>
                    <p className="font-medium">{entry.item.name}</p>
                    <p className="text-xs text-slate-500">{entry.item.itemCode}</p>
                  </TableCell>
                  <TableCell>{formatQuantity(entry.systemQuantity)}</TableCell>
                  <TableCell>{formatQuantity(entry.physicalQuantity)}</TableCell>
                  <TableCell className={cn("font-medium", Number(entry.variance) < 0 ? "text-red-600" : "text-emerald-600")}>
                    {Number(entry.variance) > 0 ? "+" : ""}
                    {formatQuantity(entry.variance)}
                  </TableCell>
                </TableRow>
              ))}
              {stockCountVarianceQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    No variances recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
