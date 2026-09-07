"use client";

import { DocumentList } from "@/components/operations/document-list";
import { AdjustmentCreateForm } from "@/components/operations/adjustment-create-form";
import type { Adjustment } from "@/lib/types";

export default function AdjustmentsListPage() {
  return (
    <DocumentList<Adjustment>
      title="Adjustments"
      endpoint="/adjustments"
      detailBasePath="/adjustments"
      docNoColumn={(a) => a.adjustmentNo}
      dialogClassName="max-w-3xl"
      statusOptions={["DRAFT", "PENDING_APPROVAL", "APPROVED", "POSTED", "CANCELLED", "REJECTED"]}
      renderCreateForm={(close) => <AdjustmentCreateForm onClose={close} />}
      columns={[
        { key: "warehouse", label: "Warehouse", render: (a) => a.warehouse?.name ?? "-" },
        { key: "reason", label: "Reason", render: (a) => a.reason.replaceAll("_", " ") },
        { key: "items", label: "Lines", render: (a) => a.items.length },
      ]}
    />
  );
}
