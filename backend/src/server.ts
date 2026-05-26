import "dotenv/config";
import express, { Application } from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";

import { connectDB } from "@/config/db";
import { getRedisClient } from "@/config/redis";
import { globalErrorHandler } from "@/middleware/error.middleware";
import apiRouter from "@/routes/index";
import { registerSocketHandlers } from "@/socket/selectionHandler";

const app: Application = express();
const httpServer = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const FRONTEND_ORIGIN = new URL(FRONTEND_URL).origin;
console.log(`📋 Socket.IO CORS origin: ${FRONTEND_ORIGIN}`);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 1e8, // 100MB
  pingInterval: 30000, // Send ping every 30s
  pingTimeout: 5000, // Wait 5s for pong
  allowUpgrades: true,
});

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Register all event handlers
  try {
    registerSocketHandlers(io, socket);
  } catch (error) {
    console.error(`❌ Error registering socket handlers for ${socket.id}:`, error);
  }

  socket.on("disconnect", (reason) => {
    console.log(`🔌 Socket disconnected: ${socket.id} — reason: ${reason}`);
  });

  socket.on("error", (error) => {
    console.error(`⚠️  Socket error on ${socket.id}:`, error);
  });
});

// Handle Socket.IO errors
io.on("error", (error) => {
  console.error(`⚠️  Socket.IO error:`, error);
});

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.get("/", (_req, res) => {
  res.status(200).send("Proofly API is running");
});

app.use("/api", apiRouter);
app.use(globalErrorHandler);

const PORT = parseInt(process.env.PORT ?? "5000", 10);

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    getRedisClient();

    // ── Increase timeouts for large file uploads ────────────────────────────
    // Default is 2 minutes — too short for multi-GB uploads
    httpServer.setTimeout(60 * 60 * 1000); // 1 hour
    httpServer.keepAliveTimeout = 65 * 60 * 1000; // 65 minutes
    httpServer.headersTimeout = 66 * 60 * 1000; // 66 minutes (must be > keepAliveTimeout)

    httpServer.listen(PORT, () => {
      console.log(`🚀 Proofly server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`⏱️  HTTP Timeout: 60 minutes (for large file uploads)`);
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

startServer();