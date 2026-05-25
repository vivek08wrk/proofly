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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-foreground" />
            <span className="text-xl font-bold tracking-tight">Proofly</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden sm:block text-sm text-muted-foreground">
                {user.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
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