import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Navbar from "@/components/shared/Navbar";

/**
 * Dashboard layout — server-side auth guard.
 * Checks for the auth cookie before rendering ANY dashboard page.
 * If no cookie → redirect to login immediately (no client-side flash).
 *
 * Note: Cookie presence check only. The actual JWT verification
 * happens on each API call via the protect middleware.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("proofly_token");

  if (!token) {
    redirect("/login");
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