"use client";

import { useEffect, useRef, useState } from "react";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TableCard({
  title,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterContent,
  filterActive,
  headerExtra,
  children,
}: {
  title: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterContent?: React.ReactNode;
  filterActive?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] p-3">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <div className="flex items-center gap-2">
          {onSearchChange && (
            <div className="relative">
              <SearchRounded className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-40 pl-8 sm:w-56"
              />
            </div>
          )}
          {filterContent && (
            <div className="relative" ref={filterRef}>
              <Button variant="outline" size="sm" onClick={() => setFilterOpen((v) => !v)} className={cn(filterActive && "border-brand-500 text-brand-600")}>
                <TuneRounded className="h-3.5 w-3.5" />
                Filter
              </Button>
              {filterOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-elevation)]">
                  {filterContent}
                </div>
              )}
            </div>
          )}
          {headerExtra}
        </div>
      </div>
      {children}
    </Card>
  );
}
