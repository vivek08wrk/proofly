"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Images,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/index";
import {
  startUpload,
  resetUpload,
  setUploadDone,
  setUploadError,
  setUploadProgress,
} from "@/store/slices/uploadSlice";
import { processIndividualImages } from "@/lib/browserZipProcessor";
import {
  getPreviewPresignedUrl,
  uploadBlobToR2,
  savePhotoMetadata,
} from "@/lib/r2DirectUploader";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface UploadZoneProps {
  projectId: string;
}

const getContentTypeForFilename = (filename: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".tiff") || lower.endsWith(".tif")) return "image/tiff";
  if (lower.endsWith(".heic")) return "image/heic";
  return "application/octet-stream";
};

export default function UploadZone({ projectId }: UploadZoneProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { status, progressPercent, errorMessage, currentProjectId } = useAppSelector(
    (state) => state.upload
  );
  const [uploadMode, setUploadMode] = useState<"zip" | "photos">("zip");
  const [currentFile, setCurrentFile] = useState<string>("");

  useEffect(() => {
    if (status !== "idle" && currentProjectId && currentProjectId !== projectId) {
      dispatch(resetUpload());
    }
  }, [projectId, currentProjectId, status, dispatch]);

  const isActive = status === "uploading";

  const runWithWakeLock = async (task: () => Promise<void>) => {
    let wakeLock: WakeLockSentinel | null = null;

    try {
      const navigatorWithWakeLock = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      };
      if (navigatorWithWakeLock.wakeLock) {
        wakeLock = await navigatorWithWakeLock.wakeLock.request("screen");
      }
    } catch {
      // Wake Lock API not available or denied.
    }

    try {
      await task();
    } finally {
      try {
        await wakeLock?.release();
      } catch {
        // Ignore wake lock release errors.
      }
    }
  };

  const uploadProcessedImages = useCallback(
    async (processedImages: Awaited<ReturnType<typeof processIndividualImages>>) => {
      if (processedImages.length === 0) {
        throw new Error("No supported images found.");
      }

      const totalPhotos = processedImages.length;

      for (let index = 0; index < processedImages.length; index += 1) {
        const processed = processedImages[index];
        const presigned = await getPreviewPresignedUrl(
          projectId,
          processed.originalFilename,
          apiClient
        );

        await uploadBlobToR2(presigned.presignedUrl, processed.blob, undefined, "image/jpeg");

        const originalContentType = getContentTypeForFilename(processed.originalFilename);
        await uploadBlobToR2(
          presigned.originalPresignedUrl,
          processed.blob,
          undefined,
          originalContentType
        );

        await savePhotoMetadata(
          projectId,
          {
            originalFilename: processed.originalFilename,
            previewUrl: presigned.previewUrl,
            previewKey: presigned.previewKey,
            originalKey: presigned.originalKey,
            width: processed.width,
            height: processed.height,
            sizeBytes: processed.sizeBytes,
            uploadOrder: processed.uploadOrder,
            isLast: index === totalPhotos - 1,
            totalPhotos,
          },
          apiClient
        );

        setCurrentFile(processed.originalFilename);
        const percent = Math.round(60 + ((index + 1) / totalPhotos) * 40);
        dispatch(setUploadProgress(percent));
      }

      dispatch(setUploadDone(projectId));
      router.refresh();
    },
    [dispatch, projectId, router]
  );

  const onDropZip = useCallback(
    async (acceptedFiles: File[]) => {
      console.log("Step 1: Drop received", acceptedFiles.length);
      const file = acceptedFiles[0];
      console.log("Step 2: File", file?.name, file?.size, file?.type);
      if (!file) {
        console.error("Step 2a: No file received");
        return;
      }

      if (!file.name.toLowerCase().endsWith(".zip")) {
        console.error("Step 3: Invalid extension", file.name);
        toast.error("Invalid file type: Please upload a .zip file containing your photos.");
        return;
      }

      dispatch(startUpload({ fileName: file.name, projectId }));
      dispatch(setUploadProgress(2));
      console.log("Step 4: Upload started", projectId);

      await runWithWakeLock(async () => {
        try {
          console.log("Step 5: Requesting presigned URL");
          const presignedRes = await apiClient.get(
            `/upload/${projectId}/presigned-url?` +
              `filename=${encodeURIComponent(file.name)}&filesize=${file.size}`
          );

          console.log("Step 6: Presigned URL response", presignedRes?.data?.success);

          const { presignedUrl, masterZipKey } = presignedRes.data.data;
          if (!presignedUrl || !masterZipKey) {
            throw new Error("Presigned URL missing from response.");
          }

          dispatch(setUploadProgress(5));
          console.log("Step 7: Uploading ZIP to R2", presignedUrl);

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener("progress", (event) => {
              if (event.lengthComputable) {
                const pct = Math.round(5 + (event.loaded / event.total) * 75);
                dispatch(setUploadProgress(pct));
                console.log("Step 7a: Upload progress", pct);
              }
            });

            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                console.log("Step 7b: R2 upload complete", xhr.status);
                resolve();
              } else {
                reject(new Error(`R2 upload failed: ${xhr.status}`));
              }
            });

            xhr.addEventListener("error", () => {
              reject(new Error("Network error while uploading to R2."));
            });

            xhr.open("PUT", presignedUrl);
            xhr.setRequestHeader("Content-Type", "application/zip");
            xhr.send(file);
          });

          dispatch(setUploadProgress(82));
          console.log("Step 8: Notifying backend to process", masterZipKey);

          await apiClient.post(`/upload/${projectId}/process`, {
            masterZipKey,
            originalFilename: file.name,
          });

          console.log("Step 9: Starting poll for project readiness");
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts += 1;
            try {
              const res = await apiClient.get(`/projects/${projectId}`);
              const statusValue = res.data.data.project.status;
              const total = res.data.data.project.totalPhotos;

              console.log("Step 9a: Poll response", statusValue, total, attempts);

              if (statusValue === "ready") {
                clearInterval(poll);
                dispatch(setUploadDone(projectId));
                router.refresh();
              } else if (statusValue === "error") {
                clearInterval(poll);
                dispatch(setUploadError("Processing failed. Try again."));
              } else if (attempts > 60) {
                clearInterval(poll);
              } else {
                const pct = Math.min(83 + attempts * 0.2, 98);
                dispatch(setUploadProgress(Math.round(pct)));
              }
            } catch (pollError) {
              console.error("Step 9b: Poll failed", pollError);
            }
          }, 5000);
        } catch (error: unknown) {
          console.error("ZIP upload error:", error);
          const err = error as {
            response?: { data?: { message?: string } };
            message?: string;
          };
          const message =
            err.response?.data?.message ??
            err.message ??
            "Upload failed. Please try again.";

          dispatch(setUploadError(message));
          toast.error(`Upload failed: ${message}`);
        }
      });
    },
    [dispatch, projectId, router]
  );

  const onDropPhotos = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      dispatch(startUpload({ fileName: `${acceptedFiles.length} photos`, projectId }));

      await runWithWakeLock(async () => {
        try {
          const processedImages = await processIndividualImages(
            acceptedFiles,
            (current, total, filename) => {
              setCurrentFile(filename);
              const percent = Math.round((current / total) * 60);
              dispatch(setUploadProgress(percent));
            }
          );

          await uploadProcessedImages(processedImages);
        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } } };
          const message =
            err.response?.data?.message ?? "Upload failed. Please try again.";

          dispatch(setUploadError(message));
          toast.error(`Upload failed: ${message}`);
        }
      });
    },
    [dispatch, projectId, uploadProcessedImages]
  );

  const {
    getRootProps: getZipRootProps,
    getInputProps: getZipInputProps,
    isDragActive: isZipDragActive,
  } = useDropzone({
    onDrop: onDropZip,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
    disabled: isActive || uploadMode !== "zip",
  });

  const {
    getRootProps: getPhotosRootProps,
    getInputProps: getPhotosInputProps,
    isDragActive: isPhotosDragActive,
  } = useDropzone({
    onDrop: onDropPhotos,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/tiff": [".tiff", ".tif"],
      "image/heic": [".heic"],
    },
    maxFiles: 500,
    disabled: isActive || uploadMode !== "photos",
  });

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

  if (isActive) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-8 space-y-4">
        <div className="text-center space-y-2">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="font-medium text-foreground">
            {progressPercent < 60
              ? "Extracting & optimizing photos..."
              : "Uploading to cloud..."}
          </p>
          {currentFile && (
            <p className="text-sm text-muted-foreground">{currentFile}</p>
          )}
          <p className="text-xs text-muted-foreground">Do not close this tab</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progressPercent < 60 ? "Processing" : "Uploading"}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex bg-muted rounded-xl p-1 gap-1">
        <button
          onClick={() => setUploadMode("zip")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
            uploadMode === "zip"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileArchive className="h-4 w-4" />
          ZIP File
        </button>
        <button
          onClick={() => setUploadMode("photos")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
            uploadMode === "photos"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Images className="h-4 w-4" />
          Individual Photos
        </button>
      </div>

      {uploadMode === "zip" && (
        <div
          {...getZipRootProps()}
          className={cn(
            "rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200",
            isZipDragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/50 hover:border-border hover:bg-muted/30"
          )}
        >
          <input {...getZipInputProps()} />
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              {isZipDragActive ? (
                <Upload className="h-8 w-8 text-primary" />
              ) : (
                <FileArchive className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {isZipDragActive ? "Drop your ZIP here" : "Drag & drop your ZIP file"}
              </p>
              <p className="text-sm text-muted-foreground">
                or{" "}
                <span className="text-primary underline underline-offset-2">
                  browse files
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-green-500 font-medium">
                ✅ Any size ZIP supported — processed in your browser
              </p>
              <p className="text-xs text-muted-foreground">
                Supports JPG, PNG, WEBP, TIFF, HEIC inside ZIP
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadMode === "photos" && (
        <div
          {...getPhotosRootProps()}
          className={cn(
            "rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200",
            isPhotosDragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/50 hover:border-border hover:bg-muted/30"
          )}
        >
          <input {...getPhotosInputProps()} />
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              {isPhotosDragActive ? (
                <Upload className="h-8 w-8 text-primary" />
              ) : (
                <Images className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {isPhotosDragActive ? "Drop photos here" : "Drag & drop your photos"}
              </p>
              <p className="text-sm text-muted-foreground">
                or{" "}
                <span className="text-primary underline underline-offset-2">
                  browse files
                </span>
              </p>
            </div>
            <p className="text-xs text-green-500 font-medium">
              ✅ Up to 500 photos — select all with Ctrl+A
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
