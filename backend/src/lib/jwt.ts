import jwt from "jsonwebtoken";
import { AuthenticatedUser } from "@/types/express.d";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

/**
 * Signs a JWT token with the user's id, email, and name.
 * Payload is minimal — we never put sensitive data in JWT.
 */
export const signToken = (user: AuthenticatedUser): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
};

/**
 * Verifies a JWT token and returns the decoded payload.
 * Throws JsonWebTokenError if invalid, TokenExpiredError if expired.
 */
export const verifyToken = (token: string): AuthenticatedUser => {
  const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
  return decoded;
};

/**
 * Attaches JWT as an httpOnly cookie on the response.
 * httpOnly = JS cannot read this cookie (XSS safe)
 * secure   = only sent over HTTPS (set true in production)
 * sameSite = strict prevents CSRF attacks
 */
export const attachTokenCookie = (
  res: import("express").Response,
  token: string
): void => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("proofly_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: "/",
  });
};

/**
 * Clears the auth cookie — used during logout.
 */
export const clearTokenCookie = (res: import("express").Response): void => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("proofly_token", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    expires: new Date(0), // Expired immediately
    path: "/",
  });
};