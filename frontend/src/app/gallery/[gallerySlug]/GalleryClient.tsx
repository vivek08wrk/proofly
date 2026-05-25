"use client";

import { useEffect, useState, useCallback } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Photo } from "@/types/project";
import MasonryGrid from "@/components/gallery/MasonryGrid";
import Lightbox from "@/components/gallery/Lightbox";
import ClientNameModal from "@/components/gallery/ClientNameModal";
import GalleryHeader from "@/components/gallery/GalleryHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";

interface GalleryData {
  project: {
    id: string;
    title: string;
    clientName: string;
    slug: string;
    totalPhotos: number;
  };
  photos: Photo[];
  existingSelection: {
    selectedPhotoIds: string[];
    totalSelected: number;
    clientName: string;
  } | null;
}

interface GalleryClientProps {
  gallerySlug: string;
}

export default function GalleryClient({
  gallerySlug,
}: GalleryClientProps) {
  const [galleryData, setGalleryData] =
    useState<GalleryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client identity
  const [clientName, setClientName] = useState<string | null>(
    null
  );
  const [showNameModal, setShowNameModal] = useState(false);

  // Selection state
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Pending selection for after name modal
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);

  // ── Fetch Gallery Data ────────────────────────────────────────

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        setIsLoading(true);
        const res = await apiClient.get<{
          success: boolean;
          data: GalleryData;
        }>(`/gallery/${gallerySlug}`);

        const data = res.data.data;
        setGalleryData(data);

        // Restore existing selections
        if (data.existingSelection) {
          setSelectedPhotoIds(
            new Set(data.existingSelection.selectedPhotoIds)
          );
          setClientName(data.existingSelection.clientName);
        }
      } catch {
        setError(
          "Gallery not found or is not available yet."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchGallery();
  }, [gallerySlug]);

  // ── Socket.IO: Join room for real-time sync ───────────────────

  useEffect(() => {
    if (!galleryData?.project.id) return;

    const socket = getSocket();

    const joinRoom = () => {
      socket.emit("join:project", galleryData.project.id);
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

    return () => {
      socket.emit("leave:project", galleryData.project.id);
      socket.off("connect", joinRoom);
    };
  }, [galleryData?.project.id]);

  // ── Selection Handler ─────────────────────────────────────────

  const handlePhotoSelect = useCallback(
    async (photoId: string, nameOverride?: string) => {
      const name = nameOverride ?? clientName;

      // If no client name yet — show modal first
      if (!name) {
        setPendingPhotoId(photoId);
        setShowNameModal(true);
        return;
      }

      const isSelected = selectedPhotoIds.has(photoId);
      const action = isSelected ? "deselect" : "select";

      // Optimistic UI update — update locally first
      setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        if (action === "select") {
          next.add(photoId);
        } else {
          next.delete(photoId);
        }
        return next;
      });

      try {
        await apiClient.post(
          `/gallery/${gallerySlug}/select`,
          {
            photoId,
            action,
            clientName: name,
          }
        );
      } catch {
        // Revert optimistic update on failure
        setSelectedPhotoIds((prev) => {
          const next = new Set(prev);
          if (action === "select") {
            next.delete(photoId);
          } else {
            next.add(photoId);
          }
          return next;
        });

        toast.error("Selection failed. Please try again.");
      }
    },
    [clientName, selectedPhotoIds, gallerySlug]
  );

  // ── Name Modal Submit ─────────────────────────────────────────

  const handleNameSubmit = useCallback(
    (name: string) => {
      setClientName(name);
      setShowNameModal(false);

      // Process pending selection
      if (pendingPhotoId) {
        handlePhotoSelect(pendingPhotoId, name);
        setPendingPhotoId(null);
      }
    },
    [pendingPhotoId, handlePhotoSelect]
  );

  // ── Lightbox Navigation ───────────────────────────────────────

  const handleOpenLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const handleLightboxNext = useCallback(() => {
    if (!galleryData) return;
    setLightboxIndex((prev) =>
      prev === null
        ? 0
        : (prev + 1) % galleryData.photos.length
    );
  }, [galleryData]);

  const handleLightboxPrev = useCallback(() => {
    if (!galleryData) return;
    setLightboxIndex((prev) =>
      prev === null
        ? 0
        : (prev - 1 + galleryData.photos.length) %
          galleryData.photos.length
    );
  }, [galleryData]);

  // ── Render ────────────────────────────────────────────────────

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !galleryData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4">
        <Camera className="h-16 w-16 text-muted-foreground/30" />
        <h1 className="text-xl font-semibold text-foreground">
          Gallery Not Found
        </h1>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          {error ??
            "This gallery link may be invalid or expired."}
        </p>
      </div>
    );
  }

  const { project, photos } = galleryData;

  return (
    <div className="min-h-screen bg-background">
      {/* Gallery Header */}
      <GalleryHeader
        title={project.title}
        clientName={project.clientName}
        totalPhotos={project.totalPhotos}
        selectedCount={selectedPhotoIds.size}
      />

      {/* Masonry Photo Grid */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
        <MasonryGrid
          photos={photos}
          selectedPhotoIds={selectedPhotoIds}
          onPhotoClick={handleOpenLightbox}
          onPhotoSelect={handlePhotoSelect}
        />
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={lightboxIndex}
          selectedPhotoIds={selectedPhotoIds}
          onClose={handleCloseLightbox}
          onNext={handleLightboxNext}
          onPrev={handleLightboxPrev}
          onSelect={handlePhotoSelect}
        />
      )}

      {/* Client Name Modal */}
      <ClientNameModal
        isOpen={showNameModal}
        defaultName={project.clientName}
        onSubmit={handleNameSubmit}
        onClose={() => {
          setShowNameModal(false);
          setPendingPhotoId(null);
        }}
      />

      {/* Floating Selection Counter */}
      {selectedPhotoIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-2 bg-foreground text-background px-5 py-3 rounded-full shadow-2xl text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            {selectedPhotoIds.size} photo
            {selectedPhotoIds.size === 1 ? "" : "s"} selected
          </div>
        </div>
      )}
    </div>
  );
}