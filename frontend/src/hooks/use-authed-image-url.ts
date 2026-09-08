import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export function useAuthedImageUrl(url: string | null): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let currentUrl: string | null = null;

    apiClient
      .get(url, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(res.data);
        setObjectUrl(currentUrl);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setObjectUrl(null);
    };
  }, [url]);

  return objectUrl;
}
