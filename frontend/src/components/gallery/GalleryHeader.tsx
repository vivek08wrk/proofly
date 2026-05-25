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
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Camera className="h-5 w-5 text-foreground shrink-0" />
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
              <span className="hidden sm:inline">
                {totalPhotos} photos
              </span>
              <span className="sm:hidden">{totalPhotos}</span>
            </div>

            {selectedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-foreground/10 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {selectedCount} selected
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}