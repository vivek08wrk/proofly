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
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}