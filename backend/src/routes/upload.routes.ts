import { Router } from "express";
import {
  uploadFolder,
  uploadZip,
  cancelUpload,
  createUploadSession,
  getPartUploadUrl,
  listUploadParts,
  completeUploadSession,
  abortUploadSession,
  getPresignedUploadUrl,
  processUploadedZip,
  getPreviewPresignedUrl,
  savePhotoMetadata,
} from "@/controllers/upload.controller";
import { protect } from "@/middleware/auth.middleware";
import rateLimit from "express-rate-limit";

// Stricter rate limit for large upload operations — max 10 per hour per IP
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many upload requests. Please wait before uploading again.",
  },
});

// Higher throughput limiter for per-photo metadata calls
const uploadMetadataRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: {
    success: false,
    message: "Too many photo metadata requests. Please try again shortly.",
  },
});

const router = Router();

router.post("/:projectId", protect, uploadRateLimiter, uploadZip);
router.post("/:projectId/folder", protect, uploadRateLimiter, uploadFolder);
router.get("/:projectId/presigned-url", protect, uploadRateLimiter, getPresignedUploadUrl);
router.post("/:projectId/process", protect, uploadRateLimiter, processUploadedZip);
router.get("/:projectId/preview-url", protect, uploadMetadataRateLimiter, getPreviewPresignedUrl);
router.post("/:projectId/save-photo", protect, uploadMetadataRateLimiter, savePhotoMetadata);
router.delete("/:projectId/cancel", protect, cancelUpload);
// Multipart resumable endpoints
router.post("/:projectId/session", protect, createUploadSession);
router.get("/:projectId/session/:uploadId/parts/:partNumber", protect, getPartUploadUrl);
router.get("/:projectId/session/:uploadId/parts", protect, listUploadParts);
router.post("/:projectId/session/:uploadId/complete", protect, completeUploadSession);
router.delete("/:projectId/session/:uploadId", protect, abortUploadSession);

export default router;