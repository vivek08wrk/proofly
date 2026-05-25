import { Router } from "express";
import authRoutes from "@/routes/auth.routes";
import projectRoutes from "@/routes/project.routes";
import uploadRoutes from "@/routes/upload.routes";
import galleryRoutes from "@/routes/gallery.routes";
import downloadRoutes from "@/routes/download.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Proofly API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/upload", uploadRoutes);
router.use("/gallery", galleryRoutes);
router.use("/download", downloadRoutes);

export default router;