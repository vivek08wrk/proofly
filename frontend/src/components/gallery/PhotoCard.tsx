"use client";

import { memo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Photo } from "@/types/project";

interface PhotoCardProps {
  photo: Photo;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onSelect: () => void;
}

const PhotoCard = memo(function PhotoCard({
  photo,
  isSelected,
  onClick,
  onSelect,
}: PhotoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Aspect ratio from actual image dimensions
  const aspectRatio =
    photo.width && photo.height
      ? photo.width / photo.height
      : 1;

  return (
    <div
      className={cn(
        "relative group cursor-pointer rounded-lg overflow-hidden",
        "transition-all duration-200",
        isSelected && "ring-2 ring-white ring-offset-2 ring-offset-background"
      )}
      style={{ aspectRatio }}
    >
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.previewUrl}
        alt={photo.originalFilename}
        className={cn(
          "w-full h-full object-cover transition-all duration-300",
          "group-hover:scale-[1.02]",
          isSelected && "brightness-90",
          !isLoaded && "opacity-0"
        )}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onClick={onClick}
      />

      {/* Dark overlay on hover */}
      <div
        className={cn(
          "absolute inset-0 bg-black/0 group-hover:bg-black/20",
          "transition-all duration-200",
          isSelected && "bg-black/10"
        )}
        onClick={onClick}
      />

      {/* Selection checkbox — top right corner */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // Don't open lightbox
          onSelect();
        }}
        className={cn(
          "absolute top-2 right-2 z-10",
          "transition-all duration-200",
          "opacity-0 group-hover:opacity-100",
          isSelected && "opacity-100"
        )}
        aria-label={
          isSelected ? "Deselect photo" : "Select photo"
        }
      >
        {isSelected ? (
          <CheckCircle2
            className="h-6 w-6 text-white drop-shadow-lg"
            fill="currentColor"
          />
        ) : (
          <Circle className="h-6 w-6 text-white drop-shadow-lg" />
        )}
      </button>

      {/* Selected indicator overlay */}
      {isSelected && (
        <div className="absolute bottom-2 left-2 z-10">
          <span className="bg-white text-black text-xs font-semibold px-2 py-0.5 rounded-full">
            Selected
          </span>
        </div>
      )}
    </div>
  );
});

export default PhotoCard;