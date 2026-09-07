"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { InventoryBalance, Paginated, Warehouse } from "@/lib/types";
import { usePagination } from "@/hooks/use-pagination";
import { downloadFile } from "@/lib/download";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table-card";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQuantity } from "@/lib/utils";

export default function InventoryPage() {
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");

  const { data: warehouses } = useQuery({
    queryKey: ["/warehouses"],
    queryFn: async () => (await apiClient.get<Paginated<Warehouse>>("/warehouses", { params: { pageSize: 100 } })).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/inventory", warehouseId],
    queryFn: async () =>
      (await apiClient.get<Paginated<InventoryBalance>>("/inventory", { params: { warehouseId: warehouseId || undefined, pageSize: 200 } })).data,
  });

  const filtered = useMemo(() => {
    let rows = data?.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.item?.name.toLowerCase().includes(q) || r.item?.itemCode.toLowerCase().includes(q));
    }
    return rows;
  }, [data, search]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, `${search}|${warehouseId}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Current Stock</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadFile(`/inventory/export.xlsx${warehouseId ? `?warehouseId=${warehouseId}` : ""}`, "current-stock.xlsx")}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Download Excel
        </Button>
      </div>

      <TableCard
        title="Current Stock"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by item name or code..."
        filterActive={!!warehouseId}
        filterContent={
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Warehouse</Label>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">All warehouses</option>
              {warehouses?.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading...</p>
        ) : (
          <>
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((balance) => (
                <TableRow key={balance.id}>
                  <TableCell>
                    <p className="font-medium">{balance.item?.name}</p>
                    <p className="text-xs text-slate-500">{balance.item?.itemCode}</p>
                  </TableCell>
                  <TableCell>{balance.warehouse?.name}</TableCell>
                  <TableCell>{balance.location?.name}</TableCell>
                  <TableCell>{formatQuantity(balance.quantity)}</TableCell>
                  <TableCell>{formatQuantity(balance.reservedQuantity)}</TableCell>
                  <TableCell className="font-medium">{formatQuantity(balance.availableQuantity)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    No inventory records
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination page={page} pageCount={pageCount} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
          </>
        )}
      </TableCard>
    </div>
  );
}
