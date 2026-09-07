import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function IconButton({
  icon: Icon,
  onClick,
  variant = "default",
  title,
  disabled,
}: {
  icon: LucideIcon;
  onClick?: () => void;
  variant?: "default" | "danger";
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40",
        variant === "danger" ? "text-[var(--color-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]" : "text-[var(--color-muted)] hover:bg-slate-100 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}
