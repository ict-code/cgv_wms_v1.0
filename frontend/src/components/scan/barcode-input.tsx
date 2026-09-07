"use client";

import { useState } from "react";
import ScanLine from "@mui/icons-material/QrCodeScannerRounded";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarcodeScannerDialog } from "./barcode-scanner-dialog";

export function BarcodeInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Scan or type barcode/item code",
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);

  function handleDetect(code: string) {
    onChange(code);
    setScannerOpen(false);
    onSubmit?.(code);
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit?.(value);
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => setScannerOpen(true)}>
        <ScanLine className="h-3.5 w-3.5" />
        Scan
      </Button>
      <BarcodeScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onDetect={handleDetect} />
    </div>
  );
}
