"use client";

import { Camera, Images, CheckCircle2 } from "lucide-react";

interface GalleryHeaderProps {
  title: string;
  clientName: string;
  totalPhotos: number;
  selectedCount: number;
}

export default function GalleryHeader({
  title,
  clientName,
  totalPhotos,
  selectedCount,
}: GalleryHeaderProps) {
  const progress =
    totalPhotos > 0 ? Math.min((selectedCount / totalPhotos) * 100, 100) : 0;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-brand">
              <Camera className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-semibold text-foreground text-sm sm:text-base truncate leading-tight">
                {title}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                For {clientName}
              </p>
            </div>
          </div>

          {/* Right: Stats */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Images className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{totalPhotos} photos</span>
              <span className="sm:hidden">{totalPhotos}</span>
            </div>

            {selectedCount > 0 && (
              <div className="brand-gradient flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-brand animate-fade-in">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {selectedCount} selected
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selection progress bar */}
      <div className="h-0.5 w-full bg-transparent">
        <div
          className="brand-gradient h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  );
}