import { Router } from "express";
import {
  getGalleryBySlug,
  updateSelection,
} from "@/controllers/gallery.controller";
import { generalRateLimiter } from "@/middleware/rateLimiter.middleware";

const router = Router();

// Public routes — rate limited but no auth
router.get("/:slug", generalRateLimiter, getGalleryBySlug);
router.post(
  "/:slug/select",
  generalRateLimiter,
  updateSelection
);

export default router;