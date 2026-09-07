"use client";

import { DocumentList } from "@/components/operations/document-list";
import { TransferCreateForm } from "@/components/operations/transfer-create-form";
import type { Transfer } from "@/lib/types";

export default function TransfersListPage() {
  return (
    <DocumentList<Transfer>
      title="Transfers"
      endpoint="/transfers"
      detailBasePath="/transfers"
      docNoColumn={(t) => t.transferNo}
      dialogClassName="max-w-3xl"
      statusOptions={["DRAFT", "PENDING_APPROVAL", "APPROVED", "IN_TRANSIT", "COMPLETED", "CANCELLED"]}
      renderCreateForm={(close) => <TransferCreateForm onClose={close} />}
      columns={[
        { key: "from", label: "From", render: (t) => t.fromLocation?.name ?? "-" },
        { key: "to", label: "To", render: (t) => t.toLocation?.name ?? "-" },
        { key: "items", label: "Lines", render: (t) => t.items.length },
      ]}
    />
  );
}
