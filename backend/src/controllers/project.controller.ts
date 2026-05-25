import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import Project from "@/models/Project.model";
import Photo from "@/models/Photo.model";
import Selection from "@/models/Selection.model";
import { createError } from "@/middleware/error.middleware";
import { generateSlug } from "@/lib/slugify";
import { deleteR2Folder } from "@/services/r2.service";

// ─── Validation Schemas ────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(100, "Title cannot exceed 100 characters")
    .trim(),
  clientName: z
    .string()
    .min(2, "Client name must be at least 2 characters")
    .max(100, "Client name cannot exceed 100 characters")
    .trim(),
  clientEmail: z
    .string()
    .email("Please provide a valid email")
    .optional()
    .or(z.literal("")),
});

type CreateProjectBody = z.infer<typeof createProjectSchema>;

// ─── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/projects
 * Creates a new project record (metadata only — no upload yet).
 * Upload happens separately via POST /api/upload/:projectId
 */
export const createProject = async (
  req: Request<object, object, CreateProjectBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = createProjectSchema.safeParse(req.body);

    if (!parseResult.success) {
      throw createError(parseResult.error.issues[0].message, 400);
    }

    const { title, clientName, clientEmail } = parseResult.data;
    const photographerId = req.user!.id;

    const slug = generateSlug(title);

    // r2FolderKey is the base path for ALL files in this project
    // Both previews and master ZIPs live under this prefix
    const projectId = new mongoose.Types.ObjectId();
    const r2FolderKey = `projects/${projectId.toString()}/`;

    const project = await Project.create({
      _id: projectId,
      photographerId,
      title,
      slug,
      clientName,
      clientEmail: clientEmail ?? undefined,
      r2FolderKey,
      status: "processing",
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: { project },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects
 * Returns all projects for the authenticated photographer.
 * Sorted by newest first.
 */
export const getProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const photographerId = req.user!.id;

    const projects = await Project.find({ photographerId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { projects, total: projects.length },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:projectId
 * Returns a single project by ID.
 * Only the owning photographer can access this.
 */
export const getProjectById = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const photographerId = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID format.", 400);
    }

    const project = await Project.findOne({
      _id: projectId,
      photographerId,
    });

    if (!project) {
      throw createError("Project not found.", 404);
    }

    // Fetch photos for this project
    const photos = await Photo.find({ projectId })
      .sort({ uploadOrder: 1 })
      .lean();

    // Fetch current selections
    const selection = await Selection.findOne({ projectId }).lean();

    res.status(200).json({
      success: true,
      data: {
        project,
        photos: photos.map((photo) => ({
          id: photo._id.toString(),
          projectId: photo.projectId.toString(),
          originalFilename: photo.originalFilename,
          previewUrl: photo.previewUrl,
          width: photo.width,
          height: photo.height,
          sizeBytes: photo.sizeBytes,
          uploadOrder: photo.uploadOrder,
        })),
        selection: selection
          ? {
              id: selection._id.toString(),
              projectId: selection.projectId.toString(),
              clientName: selection.clientName,
              selectedPhotoIds: selection.selectedPhotoIds.map((id) =>
                id.toString()
              ),
              totalSelected: selection.totalSelected,
              lastUpdatedAt: selection.lastUpdatedAt.toISOString(),
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/projects/:projectId
 * Cascade delete:
 *   1. Delete ALL R2 objects under projects/:projectId/ (previews + master ZIPs)
 *   2. Delete all Photo documents for this project
 *   3. Delete the Selection document for this project
 *   4. Delete the Project document itself
 *
 * Order matters — R2 deletion first so if it fails,
 * DB records are intact and photographer can retry.
 */
export const deleteProject = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const photographerId = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw createError("Invalid project ID format.", 400);
    }

    const project = await Project.findOne({ _id: projectId, photographerId });

    if (!project) {
      throw createError("Project not found.", 404);
    }

    // Step 1: Attempt R2 deletion — non-fatal if R2 not configured yet
    try {
      await deleteR2Folder(project.r2FolderKey);
    } catch (r2Error) {
      // Log but don't block deletion — R2 folder may not exist yet
      // (project created but ZIP never uploaded)
      console.warn("R2 folder deletion skipped or failed:", r2Error);
    }

    // Step 2: Delete all Photo records
    await Photo.deleteMany({ projectId });

    // Step 3: Delete Selection record
    await Selection.deleteOne({ projectId });

    // Step 4: Delete the Project document
    await Project.deleteOne({ _id: projectId });

    res.status(200).json({
      success: true,
      message: "Project and all associated data deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};