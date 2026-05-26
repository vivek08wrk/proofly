import { Request, Response, NextFunction } from "express";
import busboy from "busboy";
import type { FileInfo } from "busboy";
import type { Readable } from "node:stream";
import mongoose from "mongoose";
import fs from "fs";
import os from "os";
import path from "path";
import { createReadStream, createWriteStream } from "fs";
import Project from "@/models/Project.model";
import Photo from "@/models/Photo.model";
import { createError } from "@/middleware/error.middleware";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  deleteR2Folder,
  getMultipartUploadPartUrl,
  listMultipartUploadParts,
  downloadPrivateObjectToFile,
  uploadMasterZipToR2,
  uploadOriginalToR2,
  uploadPreviewToR2,
} from "@/services/r2.service";
import { processZipAndUploadPreviews } from "@/services/zip.service";
import { isSupportedImageFile, optimizeImage } from "@/services/sharp.service";
import { io } from "@/server";
import UploadSession from "@/models/UploadSession.model";
import { r2Client } from "@/config/r2";

type ActiveUploadState = {
  startedAt: number;
  canceled: boolean;
  progressTimer?: NodeJS.Timeout;
};

const activeUploads = new Map<string, ActiveUploadState>();

const clearActiveUpload = (projectId: string) => {
  const state = activeUploads.get(projectId);
  if (state?.progressTimer) {
    clearInterval(state.progressTimer);
  }
  activeUploads.delete(projectId);
};

const sanitizeFileName = (filename: string) =>
  filename.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();

const processZipFile = async (params: {
  zipFilePath: string;
  projectId: string;
  photographerId: string;
  socketRoom: string;
}) => {
  const { zipFilePath, projectId, photographerId, socketRoom } = params;

  io.to(socketRoom).emit("upload:progress", {
    phase: "processing",
    percent: 60,
    message: "Original ZIP saved. Now optimizing preview images...",
  });

  const processedPhotos = await processZipAndUploadPreviews({
    zipFilePath,
    projectId,
    io,
    socketRoom,
  });

  if (processedPhotos.length === 0) {
    throw createError("No valid images could be processed from the ZIP.", 422);
  }

  io.to(socketRoom).emit("upload:progress", {
    phase: "saving",
    percent: 97,
    message: "Saving photo records...",
  });

  const photoDocuments = processedPhotos.map((photo) => ({
    projectId: new mongoose.Types.ObjectId(projectId),
    photographerId: new mongoose.Types.ObjectId(photographerId),
    originalFilename: photo.originalFilename,
    previewUrl: photo.previewUrl,
    r2PreviewKey: photo.r2PreviewKey,
    r2OriginalKey: photo.r2OriginalKey,
    width: photo.width,
    height: photo.height,
    sizeBytes: photo.sizeBytes,
    uploadOrder: photo.uploadOrder,
  }));

  await Photo.insertMany(photoDocuments);

  await Project.findByIdAndUpdate(projectId, {
    status: "ready",
    totalPhotos: processedPhotos.length,
    coverImageUrl: processedPhotos[0]?.previewUrl ?? null,
  });

  io.to(socketRoom).emit("upload:complete", {
    projectId,
    totalPhotos: processedPhotos.length,
    message: `Successfully processed ${processedPhotos.length} photos!`,
  });

  return processedPhotos.length;
};

const processZipInBackground = async (params: {
  projectId: string;
  photographerId: string;
  masterZipKey: string;
  originalFilename: string;
  socketRoom: string;
}) => {
  const { projectId, photographerId, masterZipKey, socketRoom } = params;
  let tempZipPath: string | null = null;

  try {
    tempZipPath = path.join(
      os.tmpdir(),
      `proofly-${projectId}-${Date.now()}-direct.zip`
    );

    io.to(socketRoom).emit("upload:progress", {
      phase: "downloading",
      percent: 10,
      message: "Fetching ZIP from storage...",
    });

    await downloadPrivateObjectToFile(masterZipKey, tempZipPath);

    await processZipFile({
      zipFilePath: tempZipPath,
      projectId,
      photographerId,
      socketRoom,
    });
  } finally {
    if (tempZipPath && fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
      console.log(`🧹 Cleaned temp ZIP: ${tempZipPath}`);
    }
    clearActiveUpload(projectId);
  }
};

/**
 * GET /api/upload/:projectId/presigned-url
 * Returns a presigned URL for direct browser -> R2 upload.
 */
export const getPresignedUploadUrl = async (
  req: Request<
    { projectId: string },
    object,
    object,
    { filename?: string; filesize?: string }
  >,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { filename, filesize } = req.query;
    const photographerId = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const project = await Project.findOne({ _id: projectId, photographerId });
    if (!project) {
      throw createError("Project not found.", 404);
    }

    if (project.status === "ready") {
      throw createError("Project already has photos.", 409);
    }

    if (!filename || !filesize) {
      throw createError("filename and filesize are required.", 400);
    }

    const sanitizedFilename = String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();

    const masterZipKey = `projects/${projectId}/masters/${sanitizedFilename}`;

    const presignedUrl = await getSignedUrl(
      r2Client,
      new PutObjectCommand({
        Bucket: process.env.R2_PRIVATE_BUCKET_NAME as string,
        Key: masterZipKey,
        ContentType: "application/zip",
        ContentLength: Number(filesize),
      }),
      { expiresIn: 2 * 60 * 60 }
    );

    res.status(200).json({
      success: true,
      data: {
        presignedUrl,
        masterZipKey,
        projectId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/upload/:projectId/process
 * Trigger processing after direct R2 upload.
 */
export const processUploadedZip = async (
  req: Request<
    { projectId: string },
    object,
    { masterZipKey?: string; originalFilename?: string }
  >,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { masterZipKey, originalFilename } = req.body;
    const photographerId = req.user!.id;
    const socketRoom = `project:${projectId}`;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    if (!masterZipKey || !originalFilename) {
      throw createError("masterZipKey and originalFilename are required.", 400);
    }

    const project = await Project.findOne({ _id: projectId, photographerId });
    if (!project) {
      throw createError("Project not found.", 404);
    }

    if (project.status === "ready") {
      throw createError("Project already has photos.", 409);
    }

    const existingUpload = activeUploads.get(projectId);
    if (existingUpload && !existingUpload.canceled) {
      throw createError("Upload already in progress for this project.", 409);
    }

    clearActiveUpload(projectId);
    activeUploads.set(projectId, { startedAt: Date.now(), canceled: false });

    res.status(202).json({
      success: true,
      message: "Processing started. Watch progress updates.",
      data: { projectId },
    });

    processZipInBackground({
      projectId,
      photographerId,
      masterZipKey,
      originalFilename,
      socketRoom,
    }).catch(async (err) => {
      console.error("Background processing failed:", err);
      io.to(socketRoom).emit("upload:error", {
        message: err instanceof Error ? err.message : "Processing failed.",
      });
      await Project.findByIdAndUpdate(projectId, { status: "error" });
      clearActiveUpload(projectId);
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/upload/:projectId
 *
 * Full ZIP upload pipeline:
 * 1. Stream ZIP via busboy (low memory footprint)
 * 2. Stream ZIP to disk (temp file)
 * 3. Upload master ZIP to private R2
 * 4. Extract + optimize images → upload previews to public R2
 * 5. Save Photo documents to MongoDB
 * 6. Update Project status to "ready"
 *
 * Socket.IO room: photographer joins "project:{projectId}" room
 * to receive real-time progress updates.
 */
export const uploadZip = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectId } = req.params;
  const photographerId = req.user!.id;
  const socketRoom = `project:${projectId}`;
  let tempZipPath: string | null = null;

  console.log(`📤 ZIP upload initiated for project: ${projectId}`);
  console.log(`🔌 Socket.IO room: ${socketRoom}`);

  try {
    // ── Validate Project ──────────────────────────────────────────────────────

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const project = await Project.findOne({ _id: projectId, photographerId });

    if (!project) {
      throw createError("Project not found.", 404);
    }

    if (project.status === "ready") {
      throw createError(
        "Project already has photos. Delete the project and create a new one to re-upload.",
        409
      );
    }

    const existingUpload = activeUploads.get(projectId);
    if (existingUpload && !existingUpload.canceled) {
      throw createError("Upload already in progress for this project.", 409);
    }

    clearActiveUpload(projectId);
    activeUploads.set(projectId, { startedAt: Date.now(), canceled: false });

    // ── Stream ZIP via Busboy ─────────────────────────────────────────────────

    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: 4 * 1024 * 1024 * 1024, // 4GB max ZIP size
        files: 1,                           // Only one file per upload
      },
    });

    console.log(`🔧 Busboy initialized with headers:`, req.headers);
    let originalZipFilename = "master.zip";
    let fileReceived = false;
    tempZipPath = path.join(
      os.tmpdir(),
      `proofly-${projectId}-${Date.now()}.zip`
    );

    // Stream ZIP directly to disk to avoid buffering in memory
    bb.on("file", (_fieldname: string, fileStream: Readable, fileInfo: FileInfo) => {
      fileReceived = true;
      originalZipFilename = fileInfo.filename || "master.zip";
      console.log(`📥 Busboy received file: ${originalZipFilename}`);

      io.to(socketRoom).emit("upload:progress", {
        phase: "receiving",
        percent: 0,
        message: "Receiving ZIP file...",
      });

      const zipPath = tempZipPath;
      if (!zipPath) {
        console.error("❌ Temp ZIP path not initialized.");
        fileStream.resume();
        return;
      }

      const writeStream = createWriteStream(zipPath);
      fileStream.pipe(writeStream);

      fileStream.on("error", (err) => {
        console.error(`❌ File stream error:`, err);
        writeStream.destroy();
      });

      writeStream.on("error", (err) => {
        console.error(`❌ ZIP write error:`, err);
        fileStream.resume();
      });
    });

    // Busboy error handling
    bb.on("error", (err) => {
      console.error(`❌ Busboy error:`, err);
    });

    // After busboy finishes parsing
    bb.on("finish", async () => {
      const uploadState = activeUploads.get(projectId);

      try {
        if (uploadState?.canceled) {
          throw createError("Upload cancelled.", 409);
        }

        if (!fileReceived || !tempZipPath || !fs.existsSync(tempZipPath)) {
          throw createError("No ZIP file received in the request.", 400);
        }

        const zipStats = fs.statSync(tempZipPath);
        const zipSize = zipStats.size;
        console.log(`📦 ZIP file received: ${(zipSize / 1024 / 1024).toFixed(2)}MB`);

        if (zipSize < 100) {
          throw createError("ZIP file appears to be empty or corrupted.", 400);
        }

        console.log(`🔌 Emitting to Socket.IO room: ${socketRoom}`);
        io.to(socketRoom).emit("upload:progress", {
          phase: "uploading_master",
          percent: 5,
          message: "Saving original ZIP to secure storage...",
        });

        // ── Track 1: Upload Master ZIP to Private R2 ──────────────────────────

        const masterZipKey = `projects/${projectId}/masters/${originalZipFilename}`;
        console.log(`⬆️  Starting R2 upload for: ${masterZipKey} (${(zipSize / 1024 / 1024).toFixed(2)}MB)`);
        
        // Log memory usage before upload
        const memBefore = process.memoryUsage();
        console.log(`💾 Memory before R2 upload: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(memBefore.heapTotal / 1024 / 1024).toFixed(2)}MB`);

        // Wrap with timeout (4 hours for 2.4GB at slow speeds)
        const uploadPromise = uploadMasterZipToR2(
          masterZipKey,
          createReadStream(tempZipPath),
          "application/zip",
          (progressPercent) => {
            if (uploadState?.canceled) {
              return;
            }
            // Map 5-60% range to R2 upload progress
            const percent = 5 + (progressPercent / 100) * 55;
            io.to(socketRoom).emit("upload:progress", {
              phase: "uploading_master",
              percent: Math.round(percent),
              message: `Uploading ZIP to secure storage... ${progressPercent}%`,
            });
            console.log(`📤 Master ZIP upload: ${progressPercent}%`);
          }
        );

        // Add progress monitoring - log every 30 seconds
        let stuckCounter = 0;
        
        const progressMonitor = setInterval(() => {
          stuckCounter++;
          console.log(`⏱️  Upload still in progress (${stuckCounter * 30}s elapsed)`);
          if (stuckCounter > 120) {
            // 1 hour with no completion = stuck
            console.error(`❌ Upload appears stuck (no completion after ${stuckCounter * 30}s)`);
          }
        }, 30 * 1000);
        if (uploadState) {
          uploadState.progressTimer = progressMonitor;
        }

        const uploadTimeout = new Promise((_, reject) =>
          setTimeout(() => {
            clearInterval(progressMonitor);
            reject(new Error("R2 upload timeout after 4 hours"));
          }, 4 * 60 * 60 * 1000)
        );

        try {
          await Promise.race([uploadPromise, uploadTimeout]);
        } finally {
          clearInterval(progressMonitor);
        }

        if (uploadState?.canceled) {
          throw createError("Upload cancelled.", 409);
        }

        // Log memory usage after upload
        const memAfter = process.memoryUsage();
        console.log(`💾 Memory after R2 upload: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(memAfter.heapTotal / 1024 / 1024).toFixed(2)}MB`);

        console.log(`✅ R2 upload complete! Starting extraction and processing...`);

        const totalPhotos = await processZipFile({
          zipFilePath: tempZipPath,
          projectId,
          photographerId,
          socketRoom,
        });

        res.status(200).json({
          success: true,
          message: `Upload complete. ${totalPhotos} photos processed.`,
          data: {
            projectId,
            totalPhotos,
          },
        });
      } catch (processingError) {
        // Update project status to error
        await Project.findByIdAndUpdate(projectId, { status: "error" });

        io.to(socketRoom).emit("upload:error", {
          message:
            processingError instanceof Error
              ? processingError.message
              : "Upload processing failed.",
        });

        next(processingError);
      } finally {
        clearActiveUpload(projectId);
        if (tempZipPath && fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath);
          console.log(`🧹 Cleaned temp ZIP: ${tempZipPath}`);
        }
      }
    });

    bb.on("error", (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`❌ Busboy parsing error: ${errorMessage}`);
      clearActiveUpload(projectId);
      if (tempZipPath && fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
        console.log(`🧹 Cleaned temp ZIP: ${tempZipPath}`);
      }
      next(createError(`File parsing error: ${errorMessage}`, 400));
    });

    // Pipe request into busboy
    console.log(`🔗 Piping HTTP request to busboy parser...`);
    req.pipe(bb);

    // Request error handling
    req.on("error", (err) => {
      console.error(`❌ Request stream error:`, err);
      clearActiveUpload(projectId);
      if (tempZipPath && fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
        console.log(`🧹 Cleaned temp ZIP: ${tempZipPath}`);
      }
    });
  } catch (error) {
    console.error(`❌ Upload handler catch block:`, error);
    clearActiveUpload(projectId);
    if (tempZipPath && fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
      console.log(`🧹 Cleaned temp ZIP: ${tempZipPath}`);
    }
    next(error);
  }
};

/**
 * POST /api/upload/:projectId/folder
 * Uploads images directly from a folder (top-level only).
 */
export const uploadFolder = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectId } = req.params;
  const photographerId = req.user!.id;
  const socketRoom = `project:${projectId}`;

  console.log(`📂 Folder upload initiated for project: ${projectId}`);
  console.log(`🔌 Socket.IO room: ${socketRoom}`);

  try {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const project = await Project.findOne({ _id: projectId, photographerId });

    if (!project) {
      throw createError("Project not found.", 404);
    }

    if (project.status === "ready") {
      throw createError(
        "Project already has photos. Delete the project and create a new one to re-upload.",
        409
      );
    }

    const existingUpload = activeUploads.get(projectId);
    if (existingUpload && !existingUpload.canceled) {
      throw createError("Upload already in progress for this project.", 409);
    }

    clearActiveUpload(projectId);
    activeUploads.set(projectId, { startedAt: Date.now(), canceled: false });

    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB per file
        files: 2000,
      },
    });

    let totalImages = 0;
    let processedCount = 0;
    let fileReceived = false;
    const tasks: Array<Promise<{
      originalFilename: string;
      r2PreviewKey: string;
      r2OriginalKey: string;
      previewUrl: string;
      width: number;
      height: number;
      sizeBytes: number;
      uploadOrder: number;
    } | null>> = [];
    const limit = createConcurrencyLimiter(4);

    io.to(socketRoom).emit("upload:progress", {
      phase: "receiving",
      percent: 0,
      message: "Receiving folder images...",
    });

    bb.on("file", (_fieldname, fileStream, fileInfo) => {
      fileReceived = true;

      const normalizedPath = (fileInfo.filename || "").replace(/\\/g, "/");
      const pathParts = normalizedPath.split("/").filter(Boolean);

      // Skip files inside subfolders
      if (pathParts.length > 2) {
        fileStream.resume();
        return;
      }

      const originalFilename = pathParts[pathParts.length - 1] || "";

      if (!isSupportedImageFile(normalizedPath)) {
        fileStream.resume();
        return;
      }

      totalImages += 1;
      const uploadOrder = totalImages - 1;

      const task = limit(() => new Promise<{
        originalFilename: string;
        r2PreviewKey: string;
        r2OriginalKey: string;
        previewUrl: string;
        width: number;
        height: number;
        sizeBytes: number;
        uploadOrder: number;
      } | null>((resolve) => {
        const chunks: Buffer[] = [];

        fileStream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        fileStream.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const optimized = await optimizeImage(buffer);
            const sanitizedFilename = originalFilename
              .replace(/[^a-zA-Z0-9._-]/g, "_")
              .toLowerCase();

            const prefix = `projects/${projectId}`;
            const paddedIndex = String(uploadOrder).padStart(4, "0");
            const r2OriginalKey = `${prefix}/originals/${paddedIndex}_${sanitizedFilename}`;
            const r2PreviewKey = `${prefix}/previews/${paddedIndex}_${sanitizedFilename}`;

            const contentType = getContentTypeForExtension(
              path.extname(originalFilename).toLowerCase()
            );

            await uploadOriginalToR2(r2OriginalKey, buffer, contentType);
            const previewUrl = await uploadPreviewToR2(
              r2PreviewKey,
              optimized.buffer,
              "image/jpeg"
            );

            processedCount += 1;
            const percent = Math.round((processedCount / totalImages) * 100);

            io.to(socketRoom).emit("upload:progress", {
              phase: "optimizing",
              current: processedCount,
              total: totalImages,
              percent,
              message: `Optimized ${processedCount} of ${totalImages} photos...`,
              filename: originalFilename,
            });

            resolve({
              originalFilename,
              r2PreviewKey,
              r2OriginalKey,
              previewUrl,
              width: optimized.width,
              height: optimized.height,
              sizeBytes: optimized.sizeBytes,
              uploadOrder,
            });
          } catch (fileError) {
            console.error(
              `⚠️  Failed to process image: ${originalFilename}`,
              fileError
            );
            resolve(null);
          }
        });

        fileStream.on("error", (err: Error) => {
          console.error("Folder file stream error:", err);
          resolve(null);
        });
      }));

      tasks.push(task);
    });

    bb.on("finish", async () => {
      try {
        if (!fileReceived || totalImages === 0) {
          throw createError("No supported images found in the folder.", 400);
        }

        const processedPhotos = (await Promise.all(tasks)).filter(
          (photo): photo is NonNullable<typeof photo> => Boolean(photo)
        );

        if (processedPhotos.length === 0) {
          throw createError("No valid images could be processed.", 422);
        }

        io.to(socketRoom).emit("upload:progress", {
          phase: "saving",
          percent: 95,
          message: "Saving photo records...",
        });

        const photoDocuments = processedPhotos.map((photo) => ({
          projectId: new mongoose.Types.ObjectId(projectId),
          photographerId: new mongoose.Types.ObjectId(photographerId),
          originalFilename: photo.originalFilename,
          previewUrl: photo.previewUrl,
          r2PreviewKey: photo.r2PreviewKey,
          r2OriginalKey: photo.r2OriginalKey,
          width: photo.width,
          height: photo.height,
          sizeBytes: photo.sizeBytes,
          uploadOrder: photo.uploadOrder,
        }));

        await Photo.insertMany(photoDocuments);

        await Project.findByIdAndUpdate(projectId, {
          status: "ready",
          totalPhotos: processedPhotos.length,
          coverImageUrl: processedPhotos[0]?.previewUrl ?? null,
        });

        io.to(socketRoom).emit("upload:complete", {
          projectId,
          totalPhotos: processedPhotos.length,
          message: `Successfully processed ${processedPhotos.length} photos!`,
        });

        res.status(200).json({
          success: true,
          message: `Upload complete. ${processedPhotos.length} photos processed.`,
          data: {
            projectId,
            totalPhotos: processedPhotos.length,
          },
        });
      } catch (processingError) {
        await Project.findByIdAndUpdate(projectId, { status: "error" });

        io.to(socketRoom).emit("upload:error", {
          message:
            processingError instanceof Error
              ? processingError.message
              : "Upload processing failed.",
        });

        next(processingError);
      } finally {
        clearActiveUpload(projectId);
      }
    });

    bb.on("error", (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      clearActiveUpload(projectId);
      next(createError(`File parsing error: ${errorMessage}`, 400));
    });

    req.pipe(bb);
  } catch (error) {
    clearActiveUpload(projectId);
    next(error);
  }
};

/**
 * DELETE /api/upload/:projectId/cancel
 * 
 * Cancels an in-progress upload and cleans up:
 * 1. Deletes all R2 files for this project (previews + originals + master ZIP)
 * 2. Deletes all Photo records created during this upload
 * 3. Resets project status back to "processing"
 */
export const cancelUpload = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectId } = req.params;
  const photographerId = req.user!.id;
  const socketRoom = `project:${projectId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const project = await Project.findOne({ _id: projectId, photographerId });

    if (!project) {
      throw createError("Project not found.", 404);
    }

    // ── Delete ALL R2 content for this project ─────────────────────────────────

    const activeUpload = activeUploads.get(projectId);
    if (activeUpload) {
      activeUpload.canceled = true;
      if (activeUpload.progressTimer) {
        clearInterval(activeUpload.progressTimer);
      }
    }

    io.to(socketRoom).emit("upload:cancelled", {
      message: "Upload cancelled. Cleaning up files...",
    });

    await deleteR2Folder(project.r2FolderKey);

    // ── Delete all Photo records for this project ──────────────────────────────

    await Photo.deleteMany({ projectId: new mongoose.Types.ObjectId(projectId) });

    // ── Reset project status ──────────────────────────────────────────────────

    await Project.findByIdAndUpdate(projectId, {
      status: "processing",
      totalPhotos: 0,
      coverImageUrl: null,
    });

    io.to(socketRoom).emit("upload:cancelled_complete", {
      message: "Upload cancelled and all files deleted.",
    });

    res.status(200).json({
      success: true,
      message: "Upload cancelled and all files removed from storage.",
      data: { projectId },
    });
  } catch (error) {
    next(error);
  }
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

const createConcurrencyLimiter = (limit: number) => {
  let active = 0;
  const queue: Array<() => void> = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    active += 1;

    try {
      return await task();
    } finally {
      active -= 1;
      const next = queue.shift();
      if (next) next();
    }
  };
};

/**
 * POST /api/upload/:projectId/session
 * Create a multipart upload session and persist UploadSession
 */
export const createUploadSession = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectId } = req.params;
  const { fileName, sizeBytes, contentType } = req.body as {
    fileName?: string;
    sizeBytes?: number;
    contentType?: string;
  };

  const photographerId = req.user!.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const project = await Project.findOne({ _id: projectId, photographerId });
    if (!project) {
      throw createError("Project not found.", 404);
    }

    if (!sizeBytes || sizeBytes < 1) {
      throw createError("sizeBytes is required to create upload session.", 400);
    }

    const safeName = sanitizeFileName(fileName || "master.zip");
    const r2Key = `projects/${projectId}/masters/${safeName}`;
    const partSize = 10 * 1024 * 1024; // 10MB

    const uploadId = await createMultipartUpload(r2Key, contentType || "application/zip");

    const session = await UploadSession.create({
      projectId: new mongoose.Types.ObjectId(projectId),
      photographerId: new mongoose.Types.ObjectId(photographerId),
      uploadId,
      r2Key,
      fileName: fileName || safeName,
      contentType: contentType || "application/zip",
      sizeBytes,
      partSize,
      status: "in_progress",
    });

    await Project.findByIdAndUpdate(projectId, { status: "uploading" });

    res.status(201).json({
      success: true,
      data: { sessionId: session._id, uploadId, partSize },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/upload/:projectId/session/:uploadId/parts/:partNumber
 * Returns a presigned URL for uploading a single part
 */
export const getPartUploadUrl = async (
  req: Request<{ projectId: string; uploadId: string; partNumber: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectId, uploadId, partNumber } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const session = await UploadSession.findOne({ uploadId, projectId });
    if (!session) throw createError("Upload session not found.", 404);

    const partNum = parseInt(partNumber, 10);
    if (Number.isNaN(partNum) || partNum < 1) {
      throw createError("Invalid part number.", 400);
    }

    const url = await getMultipartUploadPartUrl(session.r2Key, uploadId, partNum);

    res.status(200).json({ success: true, data: { url, partNumber: partNum } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/upload/:projectId/session/:uploadId/parts
 * List already uploaded parts for resume support
 */
export const listUploadParts = async (
  req: Request<{ projectId: string; uploadId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectId, uploadId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const session = await UploadSession.findOne({ uploadId, projectId });
    if (!session) throw createError("Upload session not found.", 404);

    const parts = await listMultipartUploadParts(session.r2Key, uploadId);

    res.status(200).json({ success: true, data: { parts } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/upload/:projectId/session/:uploadId/complete
 * Client provides parts list [{partNumber, etag}] to complete the multipart upload.
 * After completion, server will fetch the master ZIP and start processing.
 */
export const completeUploadSession = async (
  req: Request<{ projectId: string; uploadId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectId, uploadId } = req.params;
  const { parts } = req.body as { parts: Array<{ partNumber: number; etag: string }> };
  const photographerId = req.user!.id;
  const socketRoom = `project:${projectId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const session = await UploadSession.findOne({ uploadId, projectId });
    if (!session) throw createError("Upload session not found.", 404);

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      throw createError("No parts supplied for completion.", 400);
    }

    await completeMultipartUpload(session.r2Key, uploadId, parts);

    session.status = "completed";
    await session.save();

    io.to(socketRoom).emit("upload:progress", {
      phase: "uploading_master",
      percent: 60,
      message: "Master ZIP uploaded. Starting processing...",
    });

    // Fetch master ZIP to disk and start processing asynchronously
    (async () => {
      const tempZipPath = path.join(
        os.tmpdir(),
        `proofly-${projectId}-${Date.now()}-multipart.zip`
      );

      try {
        await downloadPrivateObjectToFile(session.r2Key, tempZipPath);
        await processZipFile({
          zipFilePath: tempZipPath,
          projectId,
          photographerId,
          socketRoom,
        });
      } catch (procErr) {
        console.error("Error processing completed multipart upload:", procErr);
        io.to(socketRoom).emit("upload:error", { message: "Processing failed after upload." });
        await Project.findByIdAndUpdate(projectId, { status: "error" });
      } finally {
        if (fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath);
          console.log(`🧹 Cleaned temp ZIP: ${tempZipPath}`);
        }
      }
    })();

    res.status(200).json({ success: true, message: "Upload completed and processing started." });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/upload/:projectId/session/:uploadId
 * Abort multipart upload and remove UploadSession
 */
export const abortUploadSession = async (
  req: Request<{ projectId: string; uploadId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectId, uploadId } = req.params;
  const socketRoom = `project:${projectId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID.", 400);
    }

    const session = await UploadSession.findOne({ uploadId, projectId });
    if (!session) throw createError("Upload session not found.", 404);

    try {
      await abortMultipartUpload(session.r2Key, uploadId);
    } catch (e) {
      console.warn("Warning: abortMultipartUpload failed:", e);
    }

    session.status = "aborted";
    await session.save();

    io.to(socketRoom).emit("upload:cancelled", { message: "Multipart upload aborted." });

    res.status(200).json({ success: true, message: "Upload aborted." });
  } catch (err) {
    next(err);
  }
};