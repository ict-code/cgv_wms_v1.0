"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import PowerSettingsNewRounded from "@mui/icons-material/PowerSettingsNewRounded";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { NAV_SECTIONS, type NavSection } from "./nav-config";
import { NotificationBell } from "./notification-bell";

function isSectionActive(section: NavSection, pathname: string): boolean {
  return section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function AppBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpenSection(null);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenSection(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sections = NAV_SECTIONS.filter((section) => !section.adminOnly || user?.role === "Administrator");

  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-white px-4 py-1.5">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2" title="Warehouse Management System — City Government of Vigan">
        <Image src="/vigan-seal.png" alt="City of Vigan seal" width={28} height={28} className="h-7 w-7" priority />
        <span className="hidden text-sm font-semibold leading-tight text-foreground sm:block">WMS</span>
      </Link>

      <span className="hidden h-6 w-px shrink-0 bg-[var(--color-border)] md:block" />

      <nav ref={navRef} className="relative flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
        {sections.map((section) => {
          const key = section.title ?? section.items[0].href;
          const active = isSectionActive(section, pathname);
          const Icon = section.icon;

          if (section.items.length === 1 && !section.title) {
            const item = section.items[0];
            return (
              <Link
                key={key}
                href={item.href}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-[var(--color-muted)] hover:bg-slate-100 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }

          const isOpen = openSection === key;
          return (
            <div key={key} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenSection(isOpen ? null : key)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-[var(--color-muted)] hover:bg-slate-100 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {section.title}
                <ExpandMoreRounded className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-[var(--color-border)] bg-white py-1.5 shadow-[var(--shadow-elevation)]">
                  {section.items.map((item) => {
                    const itemActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-1.5 text-sm",
                          itemActive ? "bg-brand-50 text-brand-700" : "text-foreground hover:bg-slate-50",
                        )}
                      >
                        <ItemIcon className={cn("h-4 w-4", itemActive ? "text-brand-500" : "text-slate-400")} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
        <div className="flex items-center gap-2" title={`${user?.username ?? ""} — ${user?.role ?? ""}`}>
          <Avatar name={user?.username ?? "?"} size={28} />
          <div className="hidden leading-tight xl:block">
            <p className="text-sm font-medium text-foreground">{user?.username}</p>
            <p className="text-xs text-[var(--color-muted)]">{user?.role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Sign out"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
        >
          <PowerSettingsNewRounded className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
