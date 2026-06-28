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
        "relative group cursor-pointer rounded-xl overflow-hidden",
        "transition-all duration-300",
        isSelected
          ? "ring-2 ring-brand ring-offset-2 ring-offset-background"
          : "ring-1 ring-transparent hover:ring-foreground/10"
      )}
      style={{ aspectRatio }}
    >
      {/* Loading skeleton */}
      {!isLoaded && <div className="skeleton absolute inset-0" />}

      {/* Photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.previewUrl}
        alt={photo.originalFilename}
        className={cn(
          "w-full h-full object-cover transition-all duration-500 ease-out",
          "group-hover:scale-[1.06]",
          !isLoaded && "opacity-0"
        )}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onClick={onClick}
      />

      {/* Gradient overlay on hover / selection */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent",
          "opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          isSelected && "opacity-100"
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
          "absolute top-2.5 right-2.5 z-10 rounded-full",
          "transition-all duration-200 active:scale-90",
          "opacity-0 group-hover:opacity-100",
          isSelected && "opacity-100 animate-pop"
        )}
        aria-label={isSelected ? "Deselect photo" : "Select photo"}
      >
        {isSelected ? (
          <CheckCircle2
            className="h-6 w-6 text-brand drop-shadow-lg"
            fill="white"
          />
        ) : (
          <Circle className="h-6 w-6 text-white drop-shadow-lg" />
        )}
      </button>

      {/* Selected indicator overlay */}
      {isSelected && (
        <div className="absolute bottom-2.5 left-2.5 z-10">
          <span className="brand-gradient rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-brand">
            Selected
          </span>
        </div>
      )}
    </div>
  );
});

export default PhotoCard;