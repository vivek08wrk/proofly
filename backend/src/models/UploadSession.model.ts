import mongoose, { Document, Model, Schema } from "mongoose";

export type UploadSessionStatus = "in_progress" | "completed" | "aborted";

export interface IUploadSession extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId;
  uploadId: string;
  r2Key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  partSize: number;
  status: UploadSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const uploadSessionSchema = new Schema<IUploadSession>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    photographerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploadId: {
      type: String,
      required: true,
      index: true,
    },
    r2Key: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    partSize: {
      type: Number,
      required: true,
      min: 5 * 1024 * 1024,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "aborted"],
      default: "in_progress",
    },
  },
  {
    timestamps: true,
  }
);

uploadSessionSchema.index({ projectId: 1, status: 1 });

const UploadSession: Model<IUploadSession> = mongoose.model<IUploadSession>(
  "UploadSession",
  uploadSessionSchema
);

export default UploadSession;
