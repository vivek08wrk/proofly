import { Request, Response, NextFunction } from "express";
import Project from "@/models/Project.model";
import Photo from "@/models/Photo.model";
import Selection from "@/models/Selection.model";
import { createError } from "@/middleware/error.middleware";

/**
 * GET /api/gallery/:slug
 * Public endpoint — no auth required.
 * Returns project metadata + all optimized photo URLs for the client gallery.
 */
export const getGalleryBySlug = async (
  req: Request<{ slug: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;

    const project = await Project.findOne({
      slug,
      status: "ready",
    })
      .select(
        "title clientName slug totalPhotos coverImageUrl createdAt"
      )
      .lean();

    if (!project) {
      throw createError(
        "Gallery not found or is not ready yet.",
        404
      );
    }

    const photos = await Photo.find({ projectId: project._id })
      .sort({ uploadOrder: 1 })
      .select(
        "originalFilename previewUrl width height uploadOrder"
      )
      .lean();

    // Fetch existing selections if any
    const selection = await Selection.findOne({
      projectId: project._id,
    })
      .select("selectedPhotoIds totalSelected clientName")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project._id.toString(),
          title: project.title,
          clientName: project.clientName,
          slug: project.slug,
          totalPhotos: project.totalPhotos,
          coverImageUrl: project.coverImageUrl,
        },
        photos: photos.map((p) => ({
          id: p._id.toString(),
          originalFilename: p.originalFilename,
          previewUrl: p.previewUrl,
          width: p.width,
          height: p.height,
          uploadOrder: p.uploadOrder,
        })),
        existingSelection: selection
          ? {
              selectedPhotoIds: selection.selectedPhotoIds.map((id) =>
                id.toString()
              ),
              totalSelected: selection.totalSelected,
              clientName: selection.clientName,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/gallery/:slug/select
 * Public endpoint — client selects or deselects a photo.
 *
 * Body: { photoId: string, action: "select" | "deselect", clientName: string }
 *
 * Uses atomic MongoDB operators:
 *   $addToSet — adds photoId only if not already present (idempotent select)
 *   $pull     — removes specific photoId (deselect)
 */
export const updateSelection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const { photoId, action, clientName } = req.body;

    if (!photoId || !action || !clientName) {
      throw createError(
        "photoId, action, and clientName are required.",
        400
      );
    }

    if (!["select", "deselect"].includes(action)) {
      throw createError(
        'action must be "select" or "deselect".',
        400
      );
    }

    const project = await Project.findOne({
      slug,
      status: "ready",
    }).lean();

    if (!project) {
      throw createError("Gallery not found.", 404);
    }

    const projectId = project._id;

    // Build update based on action
    const update =
      action === "select"
        ? {
            $addToSet: {
              selectedPhotoIds: photoId,
            },
            $set: {
              clientName,
              lastUpdatedAt: new Date(),
            },
          }
        : {
            $pull: {
              selectedPhotoIds: photoId,
            },
            $set: {
              lastUpdatedAt: new Date(),
            },
          };

    // Upsert — creates document if it doesn't exist
    const updatedSelection = await Selection.findOneAndUpdate(
      { projectId },
      update,
      {
        upsert: true,
        new: true, // Return updated document
      }
    );

    // Update denormalized count
    await Selection.findByIdAndUpdate(updatedSelection._id, {
      $set: {
        totalSelected: updatedSelection.selectedPhotoIds.length,
      },
    });

    // Emit real-time update to photographer's dashboard
    // We import io here to avoid circular dependency
    const { io } = await import("@/server");

    io.to(`project:${projectId.toString()}`).emit(
      "selection:updated",
      {
        projectId: projectId.toString(),
        selectedPhotoIds:
          updatedSelection.selectedPhotoIds.map((id) =>
            id.toString()
          ),
        totalSelected: updatedSelection.selectedPhotoIds.length,
        clientName,
        action,
        photoId,
      }
    );

    res.status(200).json({
      success: true,
      data: {
        selectedPhotoIds: updatedSelection.selectedPhotoIds.map(
          (id) => id.toString()
        ),
        totalSelected: updatedSelection.selectedPhotoIds.length,
      },
    });
  } catch (error) {
    next(error);
  }
};