import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import User from "@/models/User.model";
import { signToken, attachTokenCookie, clearTokenCookie } from "@/lib/jwt";
import { createError } from "@/middleware/error.middleware";

// ─── Zod Validation Schemas ────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters")
    .trim(),
  email: z.string().email("Please provide a valid email").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"), // bcrypt limit
});

const loginSchema = z.object({
  email: z.string().email("Please provide a valid email").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

// ─── Type Inference from Zod ───────────────────────────────────────────────────

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;

// ─── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Creates a new photographer account.
 */
export const register = async (
  req: Request<object, object, RegisterBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate request body with Zod
    const parseResult = registerSchema.safeParse(req.body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0].message;
      throw createError(firstError, 400);
    }

    const { name, email, password } = parseResult.data;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw createError("An account with this email already exists.", 409);
    }

    // Create user — password hashing happens automatically via pre-save hook
    const user = await User.create({ name, email, password });

    // Generate JWT
    const token = signToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    // Attach cookie
    attachTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticates a photographer and issues a JWT cookie.
 */
export const login = async (
  req: Request<object, object, LoginBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate request body
    const parseResult = loginSchema.safeParse(req.body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0].message;
      throw createError(firstError, 400);
    }

    const { email, password } = parseResult.data;

    // Find user — explicitly select password (it's select: false by default)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      // Generic message — don't reveal if email exists or not
      throw createError("Invalid email or password.", 401);
    }

    // Compare password
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      throw createError("Invalid email or password.", 401);
    }

    // Generate JWT
    const token = signToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    // Attach cookie
    attachTokenCookie(res, token);

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Clears the auth cookie.
 */
export const logout = (
  _req: Request,
  res: Response
): void => {
  clearTokenCookie(res);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 * Protected route — requires valid JWT cookie.
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // req.user is attached by the protect middleware
    const user = await User.findById(req.user!.id);

    if (!user) {
      throw createError("User not found.", 404);
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};