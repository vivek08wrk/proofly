"use client";

import { useRouter } from "next/navigation";
import { LogOut, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/index";
import { logoutUser } from "@/store/slices/authSlice";

export default function Navbar() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    router.replace("/login");
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <span className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-brand">
              <Camera className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight">Proofly</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2.5">
                <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-1 ring-border/50">
                  {initials}
                </span>
                <span className="hidden text-sm font-medium text-foreground sm:block">
                  {user.name}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}