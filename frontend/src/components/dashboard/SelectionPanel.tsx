"use client";

import { useEffect, useState } from "react";
import { CheckSquare, User, Clock } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { Photo, SelectionState } from "@/types/project";

interface SelectionPanelProps {
  projectId: string;
  initialSelection: SelectionState;
  photos: Photo[];
}

interface SelectionUpdateEvent {
  selectedPhotoIds: string[];
  totalSelected: number;
  clientName: string;
  action: string;
  photoId: string;
}

/**
 * Real-time selection panel for photographer dashboard.
 * Listens to Socket.IO "selection:updated" events and
 * updates the display instantly — no polling needed.
 */
export default function SelectionPanel({
  projectId,
  initialSelection,
  photos,
}: SelectionPanelProps) {
  const [selection, setSelection] =
    useState<SelectionState>(initialSelection);
  const [lastActivity, setLastActivity] = useState<Date | null>(
    null
  );

  // ── Socket.IO: Listen for real-time updates ───────────────────

  useEffect(() => {
    const socket = getSocket();

    const joinRoom = () => {
      socket.emit("join:project", projectId);
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

    socket.on(
      "selection:updated",
      (data: SelectionUpdateEvent) => {
        setSelection((prev) => ({
          ...prev,
          selectedPhotoIds: data.selectedPhotoIds,
          totalSelected: data.totalSelected,
          clientName: data.clientName,
        }));
        setLastActivity(new Date());
      }
    );

    return () => {
      socket.off("selection:updated");
      socket.off("connect", joinRoom);
    };
  }, [projectId]);

  // Get selected photo objects for preview
  const selectedPhotos = photos.filter((p) =>
    selection.selectedPhotoIds.includes(p.id)
  );

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground text-sm">
            {selection.totalSelected} photos selected
          </span>
        </div>

        {lastActivity && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Just updated
          </div>
        )}
      </div>

      {/* Client Name */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        <span>
          {selection.clientName ?? "Client"} is selecting
        </span>
      </div>

      {/* Selected Photos Preview */}
      {selectedPhotos.length > 0 ? (
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
          {selectedPhotos.slice(0, 16).map((photo, index) => (
            <div
              key={`${index}-${photo.id}`}
              className="aspect-square rounded-md overflow-hidden bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={photo.originalFilename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
          {selectedPhotos.length > 16 && (
            <div className="aspect-square rounded-md bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground font-medium">
                +{selectedPhotos.length - 16}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          No photos selected yet.
          <br />
          Selections will appear here in real-time.
        </p>
      )}
    </div>
  );
}