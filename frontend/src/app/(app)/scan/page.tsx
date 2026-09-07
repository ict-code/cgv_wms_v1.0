"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import type { Item, InventoryBalance, Paginated } from "@/lib/types";
import { BarcodeInput } from "@/components/scan/barcode-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatQuantity } from "@/lib/utils";

export default function ScanPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);

  const lookupMutation = useMutation({
    mutationFn: async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) throw new Error("Enter or scan a code first");

      let foundItem: Item;
      try {
        foundItem = (await apiClient.get<Item>(`/items/barcode/${encodeURIComponent(trimmed)}`)).data;
      } catch {
        const bySearch = await apiClient.get<Paginated<Item>>("/items", { params: { search: trimmed, pageSize: 5 } });
        const exact = bySearch.data.data.find((i) => i.itemCode.toLowerCase() === trimmed.toLowerCase() || i.barcode?.toLowerCase() === trimmed.toLowerCase());
        foundItem = exact ?? bySearch.data.data[0];
        if (!foundItem) throw new Error("No item matches this barcode or code");
      }

      const balanceRes = await apiClient.get<InventoryBalance[]>(`/inventory/item/${foundItem.id}`);
      return { item: foundItem, balances: balanceRes.data };
    },
    onSuccess: (data) => {
      setItem(data.item);
      setBalances(data.balances);
      setError(null);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Item not found") : err instanceof Error ? err.message : "Item not found";
      setError(Array.isArray(message) ? message.join(", ") : message);
      setItem(null);
      setBalances([]);
    },
  });

  const totalAvailable = balances.reduce((sum, b) => sum + Number(b.availableQuantity), 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-foreground">Barcode Lookup</h1>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">Scan with a USB scanner (it types + Enter automatically), use the camera, or type the code.</p>
          <BarcodeInput value={code} onChange={setCode} onSubmit={(v) => lookupMutation.mutate(v)} autoFocus />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {item && (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{item.name}</h2>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm text-slate-500">
                  {item.itemCode} {item.barcode ? `· ${item.barcode}` : ""}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.category?.name ?? "-"} · {item.brand ?? "No brand"} · {formatCurrency(item.standardCost)} / {item.unit?.abbreviation ?? "unit"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Available</p>
                <p className="text-2xl font-bold text-foreground">{formatQuantity(totalAvailable)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table bare>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.warehouse?.name}</TableCell>
                      <TableCell>{b.location?.name}</TableCell>
                      <TableCell>{formatQuantity(b.quantity)}</TableCell>
                      <TableCell>{formatQuantity(b.reservedQuantity)}</TableCell>
                      <TableCell className="font-medium">{formatQuantity(b.availableQuantity)}</TableCell>
                    </TableRow>
                  ))}
                  {balances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-400">
                        No stock recorded for this item yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Link href="/receiving">
              <Button variant="outline">Receive Stock</Button>
            </Link>
            <Link href="/issuance">
              <Button variant="outline">Issue Stock</Button>
            </Link>
            <Link href="/transfers">
              <Button variant="outline">Transfer Stock</Button>
            </Link>
            <Link href="/items">
              <Button variant="outline">View Item</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
