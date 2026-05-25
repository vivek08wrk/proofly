"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/index";
import {
  startUpload,
  resetUpload,
  cancelUpload,
} from "@/store/slices/uploadSlice";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

// Install react-dropzone
// npm install react-dropzone

interface UploadZoneProps {
  projectId: string;
}

export default function UploadZone({ projectId }: UploadZoneProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { status, progressPercent, fileName, errorMessage, currentProjectId } = useAppSelector(
    (state) => state.upload
  );
  const [uploadMode, setUploadMode] = useState<"zip" | "folder">("zip");
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Connect to Socket.IO for real-time progress
  useUploadProgress(projectId);

  // Safety check: if upload state is for a different project, reset it
  useEffect(() => {
    if (status !== "idle" && currentProjectId && currentProjectId !== projectId) {
      dispatch(resetUpload());
    }
  }, [projectId, currentProjectId, status, dispatch]);

  const isActive = status === "uploading" || status === "processing";

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];

      if (!file) return;

      // Validate file type
      if (!file.name.endsWith(".zip")) {
        toast.error(
          "Invalid file type: Please upload a .zip file containing your photos."
        );
        return;
      }

      // Create new AbortController for this upload
      abortControllerRef.current = new AbortController();

      dispatch(startUpload({ fileName: file.name, projectId }));

      try {
        const formData = new FormData();
        formData.append("file", file);

        await apiClient.post(`/upload/${projectId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          signal: abortControllerRef.current.signal,
          timeout: 30 * 60 * 1000, // 30 min timeout for large ZIPs
        });

        toast.success(
          "Upload complete!: All photos have been processed successfully."
        );

        // Refresh the page to show updated project
        router.refresh();
      } catch (error: unknown) {
        // Don't show error message if upload was cancelled
        if (error instanceof Error && error.message === "Upload cancelled by user") {
          toast.info("Upload cancelled.");
          return;
        }

        const err = error as { response?: { data?: { message?: string } } };
        const message =
          err.response?.data?.message ?? "Upload failed. Please try again.";

        toast.error(`Upload failed: ${message}`);
      }
    },
    [projectId, dispatch, router]
  );

  const handleFolderUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) =>
        isImageFile(file.name)
      );

      if (imageFiles.length === 0) {
        toast.error("No supported images found in the folder.");
        return;
      }

      // Create new AbortController for this upload
      abortControllerRef.current = new AbortController();

      dispatch(startUpload({ fileName: `${imageFiles.length} photos`, projectId }));

      try {
        const formData = new FormData();
        for (const file of imageFiles) {
          formData.append("files", file);
        }

        await apiClient.post(`/upload/${projectId}/folder`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          signal: abortControllerRef.current.signal,
          timeout: 30 * 60 * 1000,
        });

        toast.success(
          "Upload complete!: All photos have been processed successfully."
        );

        router.refresh();
      } catch (error: unknown) {
        // Don't show error message if upload was cancelled
        if (error instanceof Error && error.message === "Upload cancelled by user") {
          toast.info("Upload cancelled.");
          return;
        }

        const err = error as { response?: { data?: { message?: string } } };
        const message =
          err.response?.data?.message ?? "Upload failed. Please try again.";

        toast.error(`Upload failed: ${message}`);
      }
    },
    [projectId, dispatch, router]
  );

  const handleCancel = useCallback(async () => {
    // Abort the HTTP request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Call backend to clean up R2 files and Photo records
    try {
      await apiClient.delete(`/upload/${projectId}/cancel`);
      toast.info("Upload cancelled. Files removed from storage.");
    } catch (error) {
      console.error("Error cancelling upload:", error);
      toast.error("Error cancelling upload. Please try again.");
    }

    // Update Redux state
    dispatch(cancelUpload());
  }, [projectId, dispatch]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
    disabled: isActive,
  });

  useEffect(() => {
    if (!folderInputRef.current) return;
    folderInputRef.current.setAttribute("webkitdirectory", "");
    folderInputRef.current.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (status === "uploading") {
      setUploadStartTime((prev) => prev ?? Date.now());
    }

    if (status === "done" || status === "error" || status === "idle") {
      setUploadStartTime(null);
    }
  }, [status]);

  // ── Render States ─────────────────────────────────────────────────────────

  if (status === "done") {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-8 text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <p className="font-semibold text-foreground">Upload Complete!</p>
        <p className="text-sm text-muted-foreground">
          All photos have been processed and are ready for your client.
        </p>
        <Button variant="outline" size="sm" onClick={() => dispatch(resetUpload())}>
          Upload Another
        </Button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="font-semibold text-foreground">Upload Failed</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <Button variant="outline" size="sm" onClick={() => dispatch(resetUpload())}>
          Try Again
        </Button>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-8 text-center space-y-3">
        <AlertCircle className="h-12 w-12 text-orange-500 mx-auto" />
        <p className="font-semibold text-foreground">Upload Cancelled</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <Button variant="outline" size="sm" onClick={() => dispatch(resetUpload())}>
          Try Again
        </Button>
      </div>
    );
  }

  if (isActive) {
    const etaText = getEstimatedTimeRemaining(
      uploadStartTime,
      progressPercent
    );
    return (
      <div className="rounded-xl border border-border/50 bg-card p-8 space-y-4">
        <div className="text-center space-y-2">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="font-medium text-foreground">
            {status === "uploading"
              ? `Uploading ${fileName}...`
              : "Optimizing photos..."}
          </p>
          <p className="text-sm text-muted-foreground">
            Do not close this tab
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {status === "uploading" ? "Uploading" : "Processing"}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {etaText && (
            <p className="text-xs text-muted-foreground text-right">
              Estimated time remaining: {etaText}
            </p>
          )}
        </div>

        {/* Cancel Button */}
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="text-destructive hover:text-destructive"
          >
            Cancel Upload
          </Button>
        </div>
      </div>
    );
  }

  // ── Default: Dropzone ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={uploadMode === "zip" ? "default" : "outline"}
          size="sm"
          onClick={() => setUploadMode("zip")}
        >
          ZIP Upload
        </Button>
        <Button
          type="button"
          variant={uploadMode === "folder" ? "default" : "outline"}
          size="sm"
          onClick={() => setUploadMode("folder")}
        >
          Folder Upload
        </Button>
      </div>

      {uploadMode === "zip" ? (
        <div
          {...getRootProps()}
          className={cn(
            "rounded-xl border-2 border-dashed p-12 text-center cursor-pointer",
            "transition-all duration-200",
            isDragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/50 hover:border-border hover:bg-muted/30"
          )}
        >
          <input {...getInputProps()} />
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              {isDragActive ? (
                <Upload className="h-8 w-8 text-primary" />
              ) : (
                <FileArchive className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {isDragActive
                  ? "Drop your ZIP here"
                  : "Drag & drop your ZIP file"}
              </p>
              <p className="text-sm text-muted-foreground">
                or{" "}
                <span className="text-primary underline underline-offset-2">
                  browse files
                </span>
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              ZIP file containing JPG, PNG, WEBP, TIFF, or HEIC photos
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-3 font-semibold text-foreground">
            Upload a folder of photos
          </p>
          <p className="text-sm text-muted-foreground">
            Only top-level images will be uploaded
          </p>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => handleFolderUpload(event.target.files)}
          />
          <Button
            type="button"
            className="mt-4 gap-2"
            onClick={() => folderInputRef.current?.click()}
            disabled={isActive}
          >
            <FolderOpen className="h-4 w-4" />
            Choose Folder
          </Button>
        </div>
      )}
    </div>
  );
}

const isImageFile = (filename: string): boolean => {
  return /\.(jpg|jpeg|png|webp|tiff|tif|heic|heif)$/i.test(filename);
};

const getEstimatedTimeRemaining = (
  startTime: number | null,
  progressPercent: number
): string | null => {
  if (!startTime || progressPercent <= 0) return null;

  const elapsedMs = Date.now() - startTime;
  const remainingPercent = 100 - progressPercent;
  if (remainingPercent <= 0) return null;

  const totalMs = (elapsedMs / progressPercent) * 100;
  const remainingMs = Math.max(totalMs - elapsedMs, 0);
  return formatDuration(remainingMs);
};

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};