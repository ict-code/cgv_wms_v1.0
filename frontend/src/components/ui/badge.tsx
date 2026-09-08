import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-slate-100 text-slate-600",
      success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
      warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
      danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
      info: "bg-[var(--color-info-bg)] text-[var(--color-info)]",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
  DRAFT: "default",
  PENDING: "warning",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  IN_PROGRESS: "info",
  SUBMITTED: "info",
  REVIEWED: "info",
  RECEIVED: "success",
  ISSUED: "success",
  COMPLETED: "success",
  POSTED: "success",
  IN_TRANSIT: "info",
  ACTIVE: "success",
  INACTIVE: "default",
  CANCELLED: "danger",
  REJECTED: "danger",
  STORED: "info",
  RETRIEVED: "warning",
  DISPOSED: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? "default"}>{status.replaceAll("_", " ")}</Badge>;
}
