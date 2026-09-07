"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";
import { usePagination } from "@/hooks/use-pagination";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { TableCard } from "@/components/ui/table-card";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export interface DocumentListColumn<T> {
  key: string;
  label: string;
  render: (item: T) => React.ReactNode;
}

interface BaseDoc {
  id: string;
  status: string;
  createdAt: string;
}

function singularize(title: string): string {
  if (title.endsWith("ies")) return `${title.slice(0, -3)}y`;
  if (title.endsWith("s")) return title.slice(0, -1);
  return title;
}

export function DocumentList<T extends BaseDoc>({
  title,
  endpoint,
  detailBasePath,
  docNoColumn,
  columns,
  renderCreateForm,
  dialogClassName,
  statusOptions,
}: {
  title: string;
  endpoint: string;
  detailBasePath: string;
  docNoColumn: (item: T) => string;
  columns: DocumentListColumn<T>[];
  renderCreateForm: (close: () => void) => React.ReactNode;
  dialogClassName?: string;
  statusOptions: string[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => (await apiClient.get<Paginated<T>>(endpoint, { params: { pageSize: 100 } })).data,
  });

  const singular = singularize(title);

  const filtered = useMemo(() => {
    let rows = data?.data ?? [];
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => docNoColumn(r).toLowerCase().includes(q));
    }
    return rows;
  }, [data, search, statusFilter, docNoColumn]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, `${search}|${statusFilter}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <Button onClick={() => setShowForm(true)}>New {singular}</Button>
      </div>

      <Dialog open={showForm} onClose={() => setShowForm(false)} title={`New ${singular}`} className={dialogClassName}>
        {renderCreateForm(() => setShowForm(false))}
      </Dialog>

      <TableCard
        title={title}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by doc number..."
        filterActive={statusFilter !== "ALL"}
        filterContent={
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
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
                <TableHead>Doc No.</TableHead>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={`${detailBasePath}/${item.id}`} className="font-medium text-foreground hover:underline">
                      {docNoColumn(item)}
                    </Link>
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.render(item)}</TableCell>
                  ))}
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDateTime(item.createdAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 3} className="text-center text-slate-400">
                    No records found
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
