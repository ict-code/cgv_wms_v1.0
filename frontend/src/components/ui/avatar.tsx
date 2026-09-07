import { colorForName, initialsForName } from "@/lib/avatar-colors";

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const { bg, text } = colorForName(name || "?");
  return (
    <span
      style={{ background: bg, color: text, width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold"
    >
      {initialsForName(name || "?")}
    </span>
  );
}
