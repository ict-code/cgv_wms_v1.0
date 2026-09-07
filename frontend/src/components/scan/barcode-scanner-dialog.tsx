"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { Dialog } from "@/components/ui/dialog";

export function BarcodeScannerDialog({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setError(null);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (cancelled || !result) return;
        onDetectRef.current(result.getText());
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not access the camera");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Scan Barcode">
      <div className="flex flex-col gap-3">
        {error ? (
          <p className="text-sm text-red-600">{error}. Grant camera permission, or enter the code manually instead.</p>
        ) : (
          <video ref={videoRef} className="aspect-video w-full rounded-md bg-black" muted playsInline />
        )}
        <p className="text-xs text-slate-500">Point the camera at a barcode. It scans automatically — no need to press anything.</p>
      </div>
    </Dialog>
  );
}
