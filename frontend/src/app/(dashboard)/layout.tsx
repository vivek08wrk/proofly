"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import { useAuth } from "@/hooks/useAuth";

/**
 * Dashboard layout — server-side auth guard.
 * Checks for the auth cookie before rendering ANY dashboard page.
 * If no cookie → redirect to login immediately (no client-side flash).
 *
 * Note: Cookie presence check only. The actual JWT verification
 * happens on each API call via the protect middleware.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient brand glow backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob right-[-10%] top-[-12%] h-96 w-96 bg-brand/10" />
        <div className="blob left-[-8%] top-[20%] h-80 w-80 bg-brand-2/10" />
      </div>

      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}