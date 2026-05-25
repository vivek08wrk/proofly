import { Router } from "express";
import { register, login, logout, getMe } from "@/controllers/auth.controller";
import { protect } from "@/middleware/auth.middleware";
import { authRateLimiter } from "@/middleware/rateLimiter.middleware";

const router = Router();

// Public routes — rate limited
router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.post("/logout", logout);

// Protected route — requires valid JWT
router.get("/me", protect, getMe);

export default router;