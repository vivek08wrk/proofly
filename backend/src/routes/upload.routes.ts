import { Router } from "express";
import { uploadFolder, uploadZip, cancelUpload } from "@/controllers/upload.controller";
import {
  createUploadSession,
  getPartUploadUrl,
  listUploadParts,
  completeUploadSession,
  abortUploadSession,
} from "@/controllers/upload.controller";
import { protect } from "@/middleware/auth.middleware";
import rateLimit from "express-rate-limit";

// Stricter rate limit for uploads — max 10 uploads per hour per IP
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many upload requests. Please wait before uploading again.",
  },
});

const router = Router();

router.post("/:projectId", protect, uploadRateLimiter, uploadZip);
router.post("/:projectId/folder", protect, uploadRateLimiter, uploadFolder);
router.delete("/:projectId/cancel", protect, cancelUpload);
// Multipart resumable endpoints
router.post("/:projectId/session", protect, createUploadSession);
router.get("/:projectId/session/:uploadId/parts/:partNumber", protect, getPartUploadUrl);
router.get("/:projectId/session/:uploadId/parts", protect, listUploadParts);
router.post("/:projectId/session/:uploadId/complete", protect, completeUploadSession);
router.delete("/:projectId/session/:uploadId", protect, abortUploadSession);

export default router;