"use client";

import { DocumentList } from "@/components/operations/document-list";
import { StockCountCreateForm } from "@/components/operations/stock-count-create-form";
import type { StockCount } from "@/lib/types";

export default function StockCountsListPage() {
  return (
    <DocumentList<StockCount>
      title="Stock Counts"
      endpoint="/stock-counts"
      detailBasePath="/stock-counts"
      docNoColumn={(s) => s.countNo}
      dialogClassName="max-w-2xl"
      statusOptions={["DRAFT", "IN_PROGRESS", "SUBMITTED", "REVIEWED", "APPROVED", "CANCELLED"]}
      renderCreateForm={(close) => <StockCountCreateForm onClose={close} />}
      columns={[
        { key: "warehouse", label: "Warehouse", render: (s) => s.warehouse?.name ?? "-" },
        { key: "location", label: "Location", render: (s) => s.location?.name ?? "-" },
        { key: "items", label: "Lines", render: (s) => s.items.length },
      ]}
    />
  );
}
