import { Router } from "express";
import {
  downloadSelectionCsv,
  downloadSelectionZip,
} from "@/controllers/download.controller";
import { protect } from "@/middleware/auth.middleware";
import rateLimit from "express-rate-limit";

// Download operations are expensive — strict rate limit
const downloadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,                   // 20 downloads per hour per IP
  message: {
    success: false,
    message:
      "Too many download requests. Please try again later.",
  },
});

const router = Router();

// Both routes require authentication (photographer only)
router.use(protect);
router.use(downloadRateLimiter);

router.get("/:projectId/csv", downloadSelectionCsv);
router.get("/:projectId/zip", downloadSelectionZip);

export default router;