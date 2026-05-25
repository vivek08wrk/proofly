import rateLimit from "express-rate-limit";

/**
 * Strict rate limiter for auth endpoints.
 * Prevents brute-force attacks on login/register.
 * 10 requests per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
});

/**
 * General API rate limiter for all other routes.
 * 100 requests per 15 minutes per IP.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});