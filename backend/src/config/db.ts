import mongoose from "mongoose";

/**
 * Connects to MongoDB using Mongoose.
 * Called once at server startup.
 * Uses a connection pool under the hood — no need to reconnect per request.
 */
export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in environment variables.");
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      // Mongoose 7+ has these defaults, but being explicit is good practice
      maxPoolSize: 10, // Max 10 concurrent connections from this server instance
    });

    console.log(
      `✅ MongoDB connected: ${connection.connection.host}`
    );
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    // Exit the process — if DB is down, server should not run
    process.exit(1);
  }
};