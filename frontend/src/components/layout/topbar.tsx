"use client";

import Image from "next/image";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./notification-bell";

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white px-6">
      <div className="flex items-center gap-2.5">
        <Image src="/vigan-seal.png" alt="City of Vigan seal" width={36} height={36} className="h-9 w-9" priority />
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">Warehouse Management System</p>
          <p className="text-xs leading-tight text-[var(--color-muted)]">City Government of Vigan</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {user ? initials(user.username) : ""}
          </span>
          <div className="text-left leading-tight">
            <p className="text-sm font-medium text-foreground">{user?.username}</p>
            <p className="text-xs text-[var(--color-muted)]">{user?.role}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
