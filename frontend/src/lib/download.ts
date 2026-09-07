import { apiClient } from "./api-client";

export async function downloadFile(endpoint: string, filename: string) {
  const response = await apiClient.get(endpoint, { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
