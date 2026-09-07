"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, notificationEntityHref } from "@/hooks/use-notifications";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unreadCount = data?.unreadCount ?? 0;

  function handleClickNotification(n: AppNotification) {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-slate-100 hover:text-foreground"
        title="Notifications"
      >
        <NotificationsRounded className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 rounded-lg border border-[var(--color-border)] bg-white shadow-[var(--shadow-elevation)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={() => markAllRead.mutate()} className="text-xs font-medium text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!data || data.data.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-400">No notifications</p>
            ) : (
              data.data.map((n) => {
                const href = notificationEntityHref(n.entityType, n.entityId);
                const content = (
                  <div className={cn("flex flex-col gap-0.5 border-b border-[var(--color-border)] px-3 py-2.5 text-sm last:border-0 hover:bg-slate-50", !n.readAt && "bg-brand-50/40")}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{n.title}</p>
                      {!n.readAt && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">{n.message}</p>
                    <p className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                );
                return href ? (
                  <Link key={n.id} href={href} onClick={() => handleClickNotification(n)}>
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} type="button" className="block w-full text-left" onClick={() => handleClickNotification(n)}>
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
