"use client";

import { memo } from "react";
import { Photo } from "@/types/project";
import PhotoCard from "@/components/gallery/PhotoCard";

interface MasonryGridProps {
  photos: Photo[];
  selectedPhotoIds: Set<string>;
  onPhotoClick: (index: number) => void;
  onPhotoSelect: (photoId: string) => void;
}

/**
 * CSS Columns-based masonry grid.
 *
 * Why CSS columns over JavaScript masonry libraries?
 * - Zero JS overhead — browser handles layout natively
 * - Smooth on mobile — no layout recalculation on resize
 * - Progressive rendering — photos appear as they load
 * - break-inside: avoid prevents photos from splitting across columns
 *
 * Column count breakpoints:
 * - Mobile (< 640px): 2 columns — enough space per photo
 * - Tablet (640-1024px): 3 columns
 * - Desktop (> 1024px): 4 columns
 */
const MasonryGrid = memo(function MasonryGrid({
  photos,
  selectedPhotoIds,
  onPhotoClick,
  onPhotoSelect,
}: MasonryGridProps) {
  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground text-sm">
          No photos in this gallery.
        </p>
      </div>
    );
  }

  return (
    <div
      className="columns-2 sm:columns-3 lg:columns-4"
      style={{ columnGap: "8px" }}
    >
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="break-inside-avoid mb-2"
        >
          <PhotoCard
            photo={photo}
            index={index}
            isSelected={selectedPhotoIds.has(photo.id)}
            onClick={() => onPhotoClick(index)}
            onSelect={() => onPhotoSelect(photo.id)}
          />
        </div>
      ))}
    </div>
  );
});

export default MasonryGrid;