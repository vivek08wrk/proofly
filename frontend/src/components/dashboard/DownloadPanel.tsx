"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  FolderArchive,
  Download,
  Loader2,
  CheckSquare,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { Photo } from "@/types/project";
import { toast } from "sonner";

interface DownloadPanelProps {
  projectId: string;
  projectSlug: string;
  totalSelected: number;
  selectedPhotos: Photo[];
}

type DownloadType = "csv" | "zip";

export default function DownloadPanel({
  projectId,
  projectSlug,
  totalSelected,
  selectedPhotos,
}: DownloadPanelProps) {
  const [downloading, setDownloading] =
    useState<DownloadType | null>(null);
  const previewPhotos = selectedPhotos.slice(0, 12);
  const remainingCount = Math.max(
    selectedPhotos.length - previewPhotos.length,
    0
  );

  const handleDownload = async (type: DownloadType) => {
    if (totalSelected === 0) {
      toast.error(
        "No selections yet: The client hasn't selected any photos yet."
      );
      return;
    }

    try {
      setDownloading(type);

      /**
       * For file downloads, we use fetch API directly instead of axios.
       * Axios doesn't handle binary blob responses as cleanly.
       * We create a temporary <a> element and programmatically click it
       * to trigger the browser's native file download dialog.
       */
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/download/${projectId}/${type}`,
        {
          method: "GET",
          credentials: "include", // Send httpOnly cookie
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { message?: string }).message ??
            "Download failed."
        );
      }

      // Get filename from Content-Disposition header
      const contentDisposition =
        response.headers.get("Content-Disposition") ?? "";
      const filenameMatch =
        contentDisposition.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] ??
        `${projectSlug}-selections.${type}`;

      // Convert response to blob
      const blob = await response.blob();

      // Create object URL and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        "Download started: " +
          (type === "csv"
            ? "CSV file downloaded. Import into Lightroom."
            : `ZIP with ${totalSelected} photos is downloading.`)
      );
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(
        "Download failed: " + (err.message ?? "Please try again.")
      );
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground text-sm">
            Download Selected
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckSquare className="h-3.5 w-3.5" />
          {totalSelected} photo
          {totalSelected === 1 ? "" : "s"} selected
        </div>
      </div>

      {selectedPhotos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Selected photos preview</span>
            <span>{selectedPhotos.length} synced from gallery</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
            {previewPhotos.map((photo, index) => (
              <div
                key={`${photo.id}-${index}`}
                className="aspect-square rounded-md overflow-hidden bg-muted border border-border/40"
                title={photo.originalFilename}
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
            {remainingCount > 0 && (
              <div className="aspect-square rounded-md bg-muted border border-border/40 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
                  +{remainingCount}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* CSV Export */}
        <button
          onClick={() => handleDownload("csv")}
          disabled={downloading !== null || totalSelected === 0}
          className={cn(
            "relative flex flex-col items-start gap-2 p-4 rounded-xl border",
            "text-left transition-all duration-200",
            "hover:border-border hover:bg-muted/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "border-border/50 bg-background"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            </div>
            {downloading === "csv" && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              CSV Export
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Lightroom filter list of selected filenames
            </p>
          </div>

          {/* Lightroom badge */}
          <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-medium">
            {selectedPhotos.length > 0
              ? `${selectedPhotos.length} files ready`
              : "Lightroom Classic"}
          </span>
        </button>

        {/* ZIP Download */}
        <button
          onClick={() => handleDownload("zip")}
          disabled={downloading !== null || totalSelected === 0}
          className={cn(
            "relative flex flex-col items-start gap-2 p-4 rounded-xl border",
            "text-left transition-all duration-200",
            "hover:border-border hover:bg-muted/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "border-border/50 bg-background"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-green-500/10">
              <FolderArchive className="h-5 w-5 text-green-500" />
            </div>
            {downloading === "zip" && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              ZIP Archive
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Download all selected photos as a ZIP
            </p>
          </div>

          {/* Size estimate badge */}
          <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium">
            ~{Math.max(Math.round(totalSelected * 0.4), 1)} MB est.
          </span>
        </button>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          ZIP contains optimized preview files (2000px, high
          quality). For RAW originals, use the CSV with
          Lightroom.
        </p>
      </div>
    </div>
  );
}