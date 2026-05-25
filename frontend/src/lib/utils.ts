import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to merge Tailwind CSS classes safely.
 * Combines clsx (conditional classes) with tailwind-merge (conflict resolution).
 *
 * Example: cn("px-2 py-1", isActive && "bg-blue-500", "px-4")
 * Result:  "py-1 bg-blue-500 px-4"  ← px-4 wins over px-2, no conflict
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}