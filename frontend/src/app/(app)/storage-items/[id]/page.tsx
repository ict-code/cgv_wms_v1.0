"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ArrowLeft, ImagePlus, Printer, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { StorageItem } from "@/lib/types";
import { useAuthedImageUrl } from "@/hooks/use-authed-image-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

const ITEM_TYPE_LABELS: Record<string, string> = {
  DOCUMENT_BOX: "Document Box",
  FURNITURE: "Furniture",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
};

export default function StorageItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [`/storage-items/${id}`],
    queryFn: async () => (await apiClient.get<StorageItem>(`/storage-items/${id}`)).data,
  });

  const photoUrl = data?.photoFilename ? `/storage-items/${id}/photo?v=${encodeURIComponent(data.photoFilename)}` : null;
  const authedPhotoUrl = useAuthedImageUrl(photoUrl);

  useEffect(() => {
    if (!data) return;
    QRCode.toDataURL(data.code, { margin: 1, width: 220 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [data]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return (await apiClient.post(`/storage-items/${id}/photo`, formData)).data;
    },
    onSuccess: () => {
      setPhotoError(null);
      queryClient.invalidateQueries({ queryKey: [`/storage-items/${id}`] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to upload photo") : "Failed to upload photo";
      setPhotoError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const removePhotoMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/storage-items/${id}/photo`);
    },
    onSuccess: () => {
      setPhotoError(null);
      queryClient.invalidateQueries({ queryKey: [`/storage-items/${id}`] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to remove photo") : "Failed to remove photo";
      setPhotoError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-label, #print-label * { visibility: visible; }
          #print-label { position: absolute; top: 0; left: 0; }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link href="/storage-items" className="mb-1 flex items-center gap-1 text-sm text-slate-500 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Storage Items
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{data.description}</h1>
          <p className="text-sm text-slate-500">{data.code}</p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 print:hidden lg:grid-cols-2">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Type</p>
              <p className="font-medium">{ITEM_TYPE_LABELS[data.itemType] ?? data.itemType}</p>
            </div>
            <div>
              <p className="text-slate-500">Quantity</p>
              <p className="font-medium">{data.quantity}</p>
            </div>
            <div>
              <p className="text-slate-500">Location</p>
              <p className="font-medium">
                {data.location?.warehouse?.name} — {data.location?.name}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Custodian</p>
              <p className="font-medium">{data.custodian?.fullname ?? "-"}</p>
            </div>
            <div>
              <p className="text-slate-500">Owner Department</p>
              <p className="font-medium">{data.ownerDepartment?.name ?? "-"}</p>
            </div>
            <div>
              <p className="text-slate-500">Date Stored</p>
              <p className="font-medium">{formatDateTime(data.dateStored)}</p>
            </div>
            <div>
              <p className="text-slate-500">Disposal Due</p>
              <p className="font-medium">{data.disposalDueDate?.slice(0, 10) ?? "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Notes</p>
              <p className="font-medium">{data.notes ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Photo</p>
              {authedPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={authedPhotoUrl} alt={data.description} className="max-h-64 w-full rounded-md border border-[var(--color-border)] object-contain" />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-[var(--color-border)] text-sm text-slate-400">
                  No photo uploaded
                </div>
              )}
              {photoError && <p className="text-sm text-red-600">{photoError}</p>}
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                  <ImagePlus className="h-3.5 w-3.5" />
                  {data.photoFilename ? "Replace Photo" : "Upload Photo"}
                </Button>
                {data.photoFilename && (
                  <Button type="button" variant="outline" size="sm" onClick={() => removePhotoMutation.mutate()} disabled={removePhotoMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center gap-3">
              <p className="w-full text-xs font-semibold uppercase text-[var(--color-muted)]">Tracking Label</p>
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt={`QR code for ${data.code}`} className="h-40 w-40" />
              )}
              <p className="font-mono text-sm text-foreground">{data.code}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" />
                Print Label
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div id="print-label" className="hidden flex-col items-center gap-2 print:flex">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt={`QR code for ${data.code}`} className="h-40 w-40" />
        )}
        <p className="font-mono text-sm">{data.code}</p>
        <p className="text-sm">{data.description}</p>
      </div>
    </div>
  );
}
