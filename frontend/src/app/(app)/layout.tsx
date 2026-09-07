"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Topbar } from "@/components/layout/topbar";
import { NavBar } from "@/components/layout/nav-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted)]">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <NavBar />
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
