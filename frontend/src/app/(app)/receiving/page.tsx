"use client";

import { DocumentList } from "@/components/operations/document-list";
import { ReceivingCreateForm } from "@/components/operations/receiving-create-form";
import type { Receiving } from "@/lib/types";

export default function ReceivingListPage() {
  return (
    <DocumentList<Receiving>
      title="Receiving"
      endpoint="/receivings"
      detailBasePath="/receiving"
      docNoColumn={(r) => r.receivingNo}
      dialogClassName="max-w-3xl"
      statusOptions={["DRAFT", "PENDING", "RECEIVED", "CANCELLED"]}
      renderCreateForm={(close) => <ReceivingCreateForm onClose={close} />}
      columns={[
        { key: "supplier", label: "Supplier", render: (r) => r.supplier?.name ?? "-" },
        { key: "warehouse", label: "Warehouse", render: (r) => r.warehouse?.name ?? "-" },
        { key: "items", label: "Lines", render: (r) => r.items.length },
      ]}
    />
  );
}
