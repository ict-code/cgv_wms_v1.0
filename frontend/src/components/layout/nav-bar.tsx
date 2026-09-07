"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, type NavSection } from "./nav-config";

function isSectionActive(section: NavSection, pathname: string): boolean {
  return section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();
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
    <nav ref={navRef} className="relative flex h-11 items-center gap-1 border-b border-[var(--color-border)] bg-white px-4">
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
                "flex h-11 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium transition-colors",
                active ? "border-brand-500 text-brand-600" : "border-transparent text-[var(--color-muted)] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
            </Link>
          );
        }

        const isOpen = openSection === key;
        return (
          <div key={key} className="relative">
            <button
              type="button"
              onClick={() => setOpenSection(isOpen ? null : key)}
              className={cn(
                "flex h-11 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium transition-colors",
                active ? "border-brand-500 text-brand-600" : "border-transparent text-[var(--color-muted)] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {section.title}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-md border border-[var(--color-border)] bg-white py-1.5 shadow-lg">
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
                      <ItemIcon className={cn("h-4 w-4", itemActive ? "text-brand-500" : "text-slate-400")} strokeWidth={2} />
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
  );
}
