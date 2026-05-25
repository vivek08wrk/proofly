import { redirect } from "next/navigation";
import { cookies } from "next/headers";

/**
 * Root page — server-side redirect based on auth cookie presence.
 * If cookie exists → go to dashboard (protect middleware will verify it).
 * If no cookie → go to login.
 *
 * This is a Server Component — no "use client" needed.
 * redirect() works server-side in Next.js App Router.
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("proofly_token");

  if (token) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}