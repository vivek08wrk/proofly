import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@/lib/jwt";
import { createError } from "@/middleware/error.middleware";

/**
 * Protects routes that require authentication.
 *
 * Token extraction order:
 * 1. httpOnly cookie (web browser clients)
 * 2. Authorization header Bearer token (API clients / mobile)
 *
 * After verification, attaches decoded user to req.user
 * so downstream controllers can access it without re-querying DB.
 */
export const protect = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    let token: string | undefined;

    // Priority 1: httpOnly cookie
    if (req.cookies?.proofly_token) {
      token = req.cookies.proofly_token as string;
    }
    // Priority 2: Authorization header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw createError("You are not logged in. Please log in to continue.", 401);
    }

    // Verify and decode — throws if expired or invalid
    const decoded = verifyToken(token);

    // Attach to request for downstream use
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    // Handle specific JWT errors with friendly messages
    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        next(createError("Your session has expired. Please log in again.", 401));
        return;
      }
      if (error.name === "JsonWebTokenError") {
        next(createError("Invalid token. Please log in again.", 401));
        return;
      }
    }
    next(error);
  }
};