import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import https from "https";
import http from "http";
import Project from "@/models/Project.model";
import Photo from "@/models/Photo.model";
import Selection from "@/models/Selection.model";
import { createError } from "@/middleware/error.middleware";
import { getPrivateSignedUrl } from "@/services/r2.service";

// ─── Helper: Fetch file from URL as a readable stream ─────────────

/**
 * Fetches a remote file (via signed URL) and returns a readable stream.
 * Handles both HTTP and HTTPS automatically.
 * Used to pipe R2 private files into the ZIP archive.
 */
const fetchFileStream = (
  url: string
): Promise<NodeJS.ReadableStream> => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(
            new Error(
              `Failed to fetch file: HTTP ${res.statusCode}`
            )
          );
          return;
        }
        resolve(res);
      })
      .on("error", reject);
  });
};

// ─── Controller 1: CSV Export ──────────────────────────────────────

/**
 * GET /api/download/:projectId/csv
 *
 * Generates a CSV file containing:
 * - All selected photo original filenames
 * - One filename per line
 *
 * Lightroom Classic usage:
 * Library → Filter Bar → Text → Filename → Contains
 * Paste all filenames (comma-separated) → Lightroom filters instantly
 *
 * Protected: only the owning photographer can download.
 */
export const downloadSelectionCsv = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const photographerId = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    // Verify ownership
    const project = await Project.findOne({
      _id: projectId,
      photographerId,
    }).lean();

    if (!project) {
      throw createError("Project not found.", 404);
    }

    // Get client's selections
    const selection = await Selection.findOne({
      projectId,
    }).lean();

    if (
      !selection ||
      selection.selectedPhotoIds.length === 0
    ) {
      throw createError(
        "No photos have been selected by the client yet.",
        404
      );
    }

    // Fetch the Photo documents for selected IDs
    const selectedPhotos = await Photo.find({
      _id: { $in: selection.selectedPhotoIds },
      projectId,
    })
      .select("originalFilename uploadOrder")
      .sort({ uploadOrder: 1 })
      .lean();

    if (selectedPhotos.length === 0) {
      throw createError("Selected photos not found.", 404);
    }

    // ── Build CSV content ─────────────────────────────────────────

    /**
     * CSV Format:
     * Line 1: Header row
     * Line 2+: One filename per row with selection index
     *
     * Also includes a "Lightroom filter string" — all filenames
     * joined by comma for easy paste into Lightroom filter bar.
     */
    const csvRows: string[] = [
      // Header
      "Selection Order,Original Filename",
      // Data rows
      ...selectedPhotos.map(
        (photo, index) =>
          `${index + 1},"${photo.originalFilename}"`
      ),
      // Empty row separator
      "",
      // Lightroom filter string (paste directly into LR filter bar)
      "Lightroom Filter String (copy everything after the colon):",
      `"${selectedPhotos
        .map((p) => p.originalFilename)
        .join(",")}"`,
    ];

    const csvContent = csvRows.join("\n");
    const csvFilename = `${project.slug}-selections-${selection.selectedPhotoIds.length}photos.csv`;

    // Set response headers for file download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${csvFilename}"`
    );
    res.setHeader(
      "Content-Length",
      Buffer.byteLength(csvContent, "utf8")
    );

    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

// ─── Controller 2: ZIP Download of Selected Originals ─────────────

/**
 * GET /api/download/:projectId/zip
 *
 * Streams a ZIP archive containing the original high-resolution
 * files for all client-selected photos.
 *
 * Flow:
 * 1. Verify photographer ownership
 * 2. Fetch selection → get selected Photo documents
 * 3. For each photo, generate a signed URL to private R2
 * 4. Stream each file into archiver ZIP
 * 5. Pipe ZIP stream directly to HTTP response
 *
 * Memory efficient: files are streamed, never fully buffered.
 * The ZIP is built on-the-fly and sent to client simultaneously.
 */
export const downloadSelectionZip = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const photographerId = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    // Verify ownership
    const project = await Project.findOne({
      _id: projectId,
      photographerId,
    }).lean();

    if (!project) {
      throw createError("Project not found.", 404);
    }

    // Get selections
    const selection = await Selection.findOne({
      projectId,
    }).lean();

    if (
      !selection ||
      selection.selectedPhotoIds.length === 0
    ) {
      throw createError(
        "No photos have been selected by the client yet.",
        404
      );
    }

    // Fetch selected Photo records
    const selectedPhotos = await Photo.find({
      _id: { $in: selection.selectedPhotoIds },
      projectId,
    })
      .select("originalFilename previewUrl r2OriginalKey uploadOrder")
      .sort({ uploadOrder: 1 })
      .lean();

    if (selectedPhotos.length === 0) {
      throw createError("Selected photo records not found.", 404);
    }

    const zipFilename = `${project.slug}-selected-${selectedPhotos.length}photos.zip`;

    // ── Set response headers for ZIP stream ───────────────────────

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFilename}"`
    );
    // No Content-Length — we don't know ZIP size upfront (streaming)
    res.setHeader("Transfer-Encoding", "chunked");

    // ── Create Archiver ZIP stream ────────────────────────────────

    const archiverImport = await import("archiver");
    const ZipArchive = (archiverImport as { ZipArchive?: new (options?: object) => any })
      .ZipArchive;

    if (!ZipArchive) {
      throw createError("Archiver module failed to load.", 500);
    }

    const archive = new ZipArchive({
      zlib: { level: 0 }, // No compression for JPEGs
      // JPEGs are already compressed — re-compressing wastes CPU
      // level: 0 = store only (fastest, no size change for JPGs)
    });

    // Pipe archive output to HTTP response
    archive.pipe(res);

    // Handle archiver errors
    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      if (!res.headersSent) {
        next(createError("Failed to create ZIP archive.", 500));
      }
    });

    // ── Add each selected photo to the ZIP ────────────────────────

    let filesAdded = 0;

    for (const photo of selectedPhotos) {
      try {
        if (!photo.r2OriginalKey) {
          throw new Error("Missing original file key for photo.");
        }

        const signedUrl = await getPrivateSignedUrl(photo.r2OriginalKey);
        const fileStream = await fetchFileStream(signedUrl);

        // Add to archive with original filename preserved
        archive.append(fileStream as NodeJS.ReadableStream, {
          name: photo.originalFilename,
        });
        filesAdded += 1;
      } catch (fileError) {
        // Log but continue — don't fail entire ZIP for one file
        console.error(
          `⚠️  Failed to add ${photo.originalFilename} to ZIP:`,
          fileError
        );
      }
    }

    if (filesAdded === 0) {
      throw createError(
        "No original files could be added to the ZIP. Re-upload the project to regenerate originals.",
        422
      );
    }

    // Finalize the archive — triggers the ZIP to complete and stream to end
    await archive.finalize();
  } catch (error) {
    // Only send error response if headers haven't been sent yet
    // (Once ZIP streaming starts, we can't send a JSON error)
    if (!res.headersSent) {
      next(error);
    } else {
      console.error("ZIP streaming error after headers sent:", error);
      res.end();
    }
  }
};