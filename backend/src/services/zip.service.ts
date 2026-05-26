import unzipper from "unzipper";
import path from "path";
import { isSupportedImageFile, optimizeImage } from "@/services/sharp.service";
import { uploadOriginalToR2, uploadPreviewToR2 } from "@/services/r2.service";
import { Server as SocketIOServer } from "socket.io";

export interface ProcessedPhoto {
  originalFilename: string;
  r2PreviewKey: string;
  r2OriginalKey: string;
  previewUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  uploadOrder: number;
}

interface ProcessZipOptions {
  zipFilePath: string;
  projectId: string;
  io: SocketIOServer;
  socketRoom: string; // Room to emit progress to
}

/**
 * Extracts a ZIP buffer in memory, optimizes each image with Sharp,
 * and uploads previews to R2 public bucket.
 *
 * Returns array of processed photo metadata for DB insertion.
 *
 * Memory strategy: We buffer the ZIP once, then process entry-by-entry.
 * Each image buffer is GC'd after upload — peak memory ~ largest single image.
 */
export const processZipAndUploadPreviews = async ({
  zipFilePath,
  projectId,
  io,
  socketRoom,
}: ProcessZipOptions): Promise<ProcessedPhoto[]> => {
  const processedPhotos: ProcessedPhoto[] = [];

  const directory = await unzipper.Open.file(zipFilePath);

  // Filter to only supported image files
  const imageEntries = directory.files.filter((entry) =>
    isSupportedImageFile(entry.path)
  );

  const totalImages = imageEntries.length;

  if (totalImages === 0) {
    throw new Error(
      "No supported image files found in ZIP. Supported formats: JPG, PNG, WEBP, TIFF, HEIC"
    );
  }

  // Emit initial progress
  io.to(socketRoom).emit("upload:progress", {
    phase: "extracting",
    current: 0,
    total: totalImages,
    percent: 0,
    message: `Found ${totalImages} images. Starting optimization...`,
  });

  let processedCount = 0;
  const concurrency = 1;

  const results = await mapWithConcurrency(
    imageEntries,
    concurrency,
    async (entry, index) => {
      const originalFilename = path.basename(entry.path);

      try {
        // Read entry into buffer
        const imageBuffer = await entry.buffer();

        const extension = path.extname(originalFilename).toLowerCase();
        const contentType = getContentTypeForExtension(extension);

        // Optimize with Sharp
        const optimized = await optimizeImage(imageBuffer);

        // Build R2 key: projects/:projectId/previews/:filename
        const sanitizedFilename = originalFilename
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .toLowerCase();

        const paddedIndex = String(index).padStart(4, "0");
        const r2PreviewKey = `projects/${projectId}/previews/${paddedIndex}_${sanitizedFilename}`;

        const r2OriginalKey = `projects/${projectId}/originals/${paddedIndex}_${sanitizedFilename}`;

        // Upload original to private bucket for full-quality downloads
        await uploadOriginalToR2(r2OriginalKey, imageBuffer, contentType);

        // Upload to public R2 bucket
        const previewUrl = await uploadPreviewToR2(
          r2PreviewKey,
          optimized.buffer,
          "image/jpeg"
        );

        processedCount += 1;
        const percent = Math.round(60 + (processedCount / totalImages) * 35);

        io.to(socketRoom).emit("upload:progress", {
          phase: "optimizing",
          current: processedCount,
          total: totalImages,
          percent,
          message: `Optimized ${processedCount} of ${totalImages} photos...`,
          filename: originalFilename,
        });

        return {
          originalFilename,
          r2PreviewKey,
          r2OriginalKey,
          previewUrl,
          width: optimized.width,
          height: optimized.height,
          sizeBytes: optimized.sizeBytes,
          uploadOrder: index,
        };
      } catch (entryError) {
        // Log but don't fail the whole batch for one bad image
        console.error(
          `⚠️  Failed to process image: ${originalFilename}`,
          entryError
        );
        return null;
      }
    }
  );

  for (const result of results) {
    if (result) {
      processedPhotos.push(result);
    }
  }

  processedPhotos.sort((a, b) => a.uploadOrder - b.uploadOrder);

  return processedPhotos;
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

const getContentTypeForExtension = (extension: string): string => {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".tiff":
    case ".tif":
      return "image/tiff";
    case ".heic":
    case ".heif":
      return "image/heic";
    default:
      return "application/octet-stream";
  }
};