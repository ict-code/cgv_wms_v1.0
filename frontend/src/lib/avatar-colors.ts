const PALETTE = [
  { bg: "#dbeafe", text: "#2563eb" },
  { bg: "#fce7f3", text: "#db2777" },
  { bg: "#cffafe", text: "#0891b2" },
  { bg: "#ffedd5", text: "#ea580c" },
  { bg: "#dcfce7", text: "#16a34a" },
  { bg: "#ede9fe", text: "#7c3aed" },
  { bg: "#fef3c7", text: "#d97706" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function colorForName(name: string) {
  return PALETTE[hashString(name) % PALETTE.length];
}

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
