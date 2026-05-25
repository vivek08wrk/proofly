/**
 * Standard API response wrapper shape.
 * Every backend response follows this structure.
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}