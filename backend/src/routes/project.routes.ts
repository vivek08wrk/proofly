import { Router } from "express";
import {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
} from "@/controllers/project.controller";
import { protect } from "@/middleware/auth.middleware";
import { generalRateLimiter } from "@/middleware/rateLimiter.middleware";

const router = Router();

// All project routes require authentication
router.use(protect);
router.use(generalRateLimiter);

router.post("/", createProject);
router.get("/", getProjects);
router.get("/:projectId", getProjectById);
router.delete("/:projectId", deleteProject);

export default router;