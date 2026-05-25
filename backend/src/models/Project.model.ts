import mongoose, { Document, Schema, Model } from "mongoose";

// ─── TypeScript Interface ──────────────────────────────────────────────────────

export type ProjectStatus = "processing" | "ready" | "error";

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId; // Reference to User
  title: string;
  slug: string;           // URL-safe unique identifier for public gallery
  clientName: string;
  clientEmail?: string;
  coverImageUrl?: string; // First optimized photo URL — shown as gallery thumbnail
  totalPhotos: number;    // Denormalized count for fast dashboard display
  status: ProjectStatus;  // Track ZIP processing state
  r2FolderKey: string;    // Base R2 path: "projects/:projectId/" — used for cascade delete
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema Definition ─────────────────────────────────────────────────────────

const projectSchema = new Schema<IProject>(
  {
    photographerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Photographer ID is required"],
      index: true, // We query "all projects by this photographer" frequently
    },

    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Slug format: only letters, numbers, hyphens
      match: [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
    },

    clientName: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
      maxlength: [100, "Client name cannot exceed 100 characters"],
    },

    clientEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },

    coverImageUrl: {
      type: String,
      default: null,
    },

    totalPhotos: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: {
        values: ["processing", "ready", "error"] as ProjectStatus[],
        message: "Status must be processing, ready, or error",
      },
      default: "processing",
    },

    /**
     * r2FolderKey stores the base path in R2 for this project.
     * Format: "projects/507f1f77bcf86cd799439011/"
     *
     * During cascade delete, we list and delete ALL objects
     * under this prefix — covers both preview images and master ZIPs.
     */
    r2FolderKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret:any) {
        ret.id = ret._id.toString();
        ret.photographerId = ret.photographerId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Compound Index ────────────────────────────────────────────────────────────

/**
 * Compound index on photographerId + createdAt (descending).
 * Dashboard query: "give me all projects for this photographer, newest first"
 * This single index covers that query perfectly — no collection scan.
 */
projectSchema.index({ photographerId: 1, createdAt: -1 });

// ─── Model Export ──────────────────────────────────────────────────────────────

const Project: Model<IProject> = mongoose.model<IProject>("Project", projectSchema);
export default Project;