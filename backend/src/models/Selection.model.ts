import mongoose, { Document, Schema, Model } from "mongoose";

// ─── TypeScript Interface ──────────────────────────────────────────────────────

export interface ISelection extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  clientName: string;      // Stored for display — client provides name on entry
  clientEmail?: string;
  selectedPhotoIds: mongoose.Types.ObjectId[]; // Array of Photo _ids
  totalSelected: number;   // Denormalized count — avoids .length call on large arrays
  lastUpdatedAt: Date;     // Separate from Mongoose updatedAt — tracks last selection change
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema Definition ─────────────────────────────────────────────────────────

const selectionSchema = new Schema<ISelection>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
      /**
       * unique: true here means ONE selection document per project.
       * A client's entire selection = one document.
       * When client selects/deselects, we update this document (not create new ones).
       * This is the "accumulator" pattern — efficient for real-time updates.
       */
      unique: true,
      index: true,
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
    },

    /**
     * Array of Photo ObjectIds that the client has selected.
     * We use $addToSet and $pull operators on this array for atomic updates:
     *   - $addToSet: adds a photoId only if not already present (select)
     *   - $pull: removes a specific photoId (deselect)
     * This avoids race conditions in real-time selection updates.
     */
    selectedPhotoIds: {
      type: [Schema.Types.ObjectId],
      ref: "Photo",
      default: [],
    },

    totalSelected: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret:any) {
        ret.id = ret._id.toString();
        ret.projectId = ret.projectId.toString();
        ret.selectedPhotoIds = ret.selectedPhotoIds.map(
          (id: mongoose.Types.ObjectId) => id.toString()
        );
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Model Export ──────────────────────────────────────────────────────────────

const Selection: Model<ISelection> = mongoose.model<ISelection>(
  "Selection",
  selectionSchema
);
export default Selection;