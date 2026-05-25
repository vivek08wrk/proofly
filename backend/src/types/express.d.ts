// Extending the Express Request interface globally
// This allows us to attach the authenticated user payload
// to req.user after JWT verification middleware runs.
// Without this, TypeScript will throw an error on req.user access.

import { JwtPayload } from "jsonwebtoken";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}