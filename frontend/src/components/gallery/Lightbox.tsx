"use client";

import { useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Photo } from "@/types/project";

interface LightboxProps {
  photos: Photo[];
  currentIndex: number;
  selectedPhotoIds: Set<string>;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSelect: (photoId: string) => void;
  onJump?: (index: number) => void;
}

export default function Lightbox({
  photos,
  currentIndex,
  selectedPhotoIds,
  onClose,
  onNext,
  onPrev,
  onSelect,
  onJump,
}: LightboxProps) {
  const photo = photos[currentIndex];
  const isSelected = photo ? selectedPhotoIds.has(photo.id) : false;
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onNext();
      if (event.key === "ArrowLeft") onPrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrev]);

  // Keep the active thumbnail scrolled into view as you navigate.
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentIndex]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          className={cn(
            "rounded-full p-2 text-white transition-all active:scale-90",
            isSelected
              ? "brand-gradient shadow-brand"
              : "bg-white/10 hover:bg-white/20"
          )}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(photo.id);
          }}
          aria-label={isSelected ? "Deselect photo" : "Select photo"}
        >
          {isSelected ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
        <button
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 active:scale-90"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Close lightbox"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Prev / Next */}
      <button
        className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 active:scale-90"
        onClick={(event) => {
          event.stopPropagation();
          onPrev();
        }}
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 active:scale-90"
        onClick={(event) => {
          event.stopPropagation();
          onNext();
        }}
        aria-label="Next photo"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Main image */}
      <div
        className="flex flex-1 items-center justify-center px-6 pt-6 pb-2"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.previewUrl}
          alt={photo.originalFilename}
          className="max-h-[78vh] w-auto max-w-full rounded-lg shadow-2xl animate-zoom-in"
        />
      </div>

      {/* Counter */}
      <div className="pointer-events-none mx-auto mb-2 rounded-full bg-white/10 px-4 py-1 text-xs font-medium text-white tabular-nums">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Thumbnail strip */}
      <div
        className="flex shrink-0 items-center gap-2 overflow-x-auto px-4 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        {photos.map((p, i) => {
          const active = i === currentIndex;
          return (
            <button
              key={p.id}
              ref={active ? activeThumbRef : null}
              onClick={() => onJump?.(i)}
              className={cn(
                "relative h-14 w-14 shrink-0 overflow-hidden rounded-md transition-all duration-200",
                active
                  ? "ring-2 ring-brand ring-offset-2 ring-offset-black/90"
                  : "opacity-50 hover:opacity-90"
              )}
              aria-label={`View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={p.originalFilename}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {selectedPhotoIds.has(p.id) && (
                <span className="absolute right-0.5 top-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand" fill="white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
