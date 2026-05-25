import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";

// ─── TypeScript Interface ──────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;

  // Instance method — available on every User document
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ─── Schema Definition ─────────────────────────────────────────────────────────

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true, // Always store emails in lowercase
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      // select: false means password field won't be returned in queries by default
      // You must explicitly do User.findOne().select("+password") to get it
      select: false,
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
    // When converting to JSON (API responses), remove __v and transform _id
    toJSON: {
      transform(_doc, ret:any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password; // Extra safety — never expose password in JSON
        return ret;
      },
    },
  }
);

// ─── Pre-Save Hook: Password Hashing ──────────────────────────────────────────

/**
 * Before saving a User document, hash the password if it was modified.
 * This runs on both CREATE and UPDATE operations.
 * bcrypt salt rounds = 12 is a good balance of security vs. CPU cost.
 */
userSchema.pre("save", async function (next) {
  // Only hash if password field was actually changed
  if (!this.isModified("password")) {
    return next();
  }

  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// ─── Instance Method: Password Comparison ─────────────────────────────────────

/**
 * Compare a plain-text password against the stored hash.
 * Used during login — bcrypt.compare is timing-safe (prevents timing attacks).
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Model Export ──────────────────────────────────────────────────────────────

const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;