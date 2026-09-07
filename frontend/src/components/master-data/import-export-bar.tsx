"use client";

import { useRef, useState } from "react";
import { AxiosError } from "axios";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { downloadFile } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function ImportExportBar({
  endpoint,
  resourceName,
  onImported,
}: {
  endpoint: string;
  resourceName: string;
  onImported?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<{ created: number; updated: number }>(`${endpoint}/import`, formData);
      setResult(data);
      setErrors(null);
      onImported?.();
    } catch (err) {
      const payload = err instanceof AxiosError ? (err.response?.data as { message?: string | string[]; errors?: string[] } | undefined) : undefined;
      const list = payload?.errors ?? (Array.isArray(payload?.message) ? payload.message : payload?.message ? [payload.message] : ["Import failed"]);
      setErrors(list);
      setResult(null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
        <Upload className="h-3.5 w-3.5" />
        {importing ? "Importing..." : "Import CSV"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadFile(`${endpoint}/export.csv`, `${resourceName}.csv`)}>
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadFile(`${endpoint}/export.xlsx`, `${resourceName}.xlsx`)}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Download Excel
      </Button>

      <Dialog
        open={result !== null || errors !== null}
        onClose={() => {
          setResult(null);
          setErrors(null);
        }}
        title={errors ? "Import failed" : "Import complete"}
      >
        {errors ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-600">No rows were imported. Fix the following and re-upload:</p>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-3 text-sm text-[var(--color-danger)]">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : result ? (
          <p className="text-sm text-slate-600">
            {result.created} created, {result.updated} updated.
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
