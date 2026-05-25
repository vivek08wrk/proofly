import mongoose, { Document, Schema, Model } from "mongoose";

// ─── TypeScript Interface ──────────────────────────────────────────────────────

export interface IPhoto extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;   // Reference to Project
  photographerId: mongoose.Types.ObjectId; // Denormalized for fast ownership checks
  originalFilename: string;  // Exact filename from ZIP (used for Lightroom CSV export)
  previewUrl: string;        // Full CDN URL of optimized JPG (shown in gallery UI)
  r2PreviewKey: string;      // R2 object key for the preview (used for deletion)
  r2OriginalKey: string;     // R2 object key for the original file (private bucket)
  width: number;             // Image dimensions — needed for masonry layout calculation
  height: number;
  sizeBytes: number;         // Optimized file size in bytes
  uploadOrder: number;       // Preserve photographer's original ZIP ordering
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema Definition ─────────────────────────────────────────────────────────

const photoSchema = new Schema<IPhoto>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
      index: true,
    },

    photographerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Photographer ID is required"],
    },

    originalFilename: {
      type: String,
      required: [true, "Original filename is required"],
      trim: true,
    },

    /**
     * Full CDN URL served directly to the browser.
     * Example: "https://pub-xxxx.r2.dev/projects/abc123/previews/photo-001.jpg"
     * This is what <img> tags in the gallery use.
     */
    previewUrl: {
      type: String,
      required: [true, "Preview URL is required"],
    },

    /**
     * R2 object key — NOT the full URL.
     * Example: "projects/abc123/previews/photo-001.jpg"
     * Used by the delete service to call R2's DeleteObject API.
     */
    r2PreviewKey: {
      type: String,
      required: [true, "R2 preview key is required"],
    },

    /**
     * R2 object key for the original file in the private bucket.
     * Example: "projects/abc123/originals/0001_photo-001.jpg"
     */
    r2OriginalKey: {
      type: String,
      required: [true, "R2 original key is required"],
    },

    width: {
      type: Number,
      required: [true, "Image width is required"],
      min: 1,
    },

    height: {
      type: Number,
      required: [true, "Image height is required"],
      min: 1,
    },

    sizeBytes: {
      type: Number,
      required: [true, "File size is required"],
      min: 0,
    },

    /**
     * Preserves the natural order of photos as they appeared in the ZIP.
     * Used when sorting: Photo.find({ projectId }).sort({ uploadOrder: 1 })
     * Without this, MongoDB returns documents in insertion order which
     * may not match the original album sequence.
     */
    uploadOrder: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc,ret:any) {
        ret.id = ret._id.toString();
        ret.projectId = ret.projectId.toString();
        ret.photographerId = ret.photographerId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────

/**
 * Primary query: "get all photos for this project, in order"
 * Photo.find({ projectId }).sort({ uploadOrder: 1 })
 * Compound index covers both the filter and the sort in one pass.
 */
photoSchema.index({ projectId: 1, uploadOrder: 1 });

// ─── Model Export ──────────────────────────────────────────────────────────────

const Photo: Model<IPhoto> = mongoose.model<IPhoto>("Photo", photoSchema);
export default Photo;