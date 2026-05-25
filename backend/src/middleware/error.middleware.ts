import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handling middleware.
 * Must be registered LAST in Express middleware chain (after all routes).
 * Catches all errors passed via next(error) from any route/controller.
 */
export const globalErrorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? "Internal Server Error";

  if (process.env.NODE_ENV === "development") {
    console.error("🔥 Error:", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only expose stack trace in development — never in production
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

/**
 * Factory function to create consistent operational errors.
 * Usage: throw createError("Project not found", 404)
 */
export const createError = (message: string, statusCode: number): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};