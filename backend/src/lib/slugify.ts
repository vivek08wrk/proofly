import { v4 as uuidv4 } from "uuid";

/**
 * Converts a title string into a URL-safe slug with a short unique suffix.
 * Example: "Sarah & John's Wedding!" → "sarah-johns-wedding-a3f9"
 *
 * The 4-char suffix prevents collisions when two projects have the same title.
 */
export const generateSlug = (title: string): string => {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-")          // Replace spaces with hyphens
    .replace(/-+/g, "-")           // Collapse multiple hyphens
    .slice(0, 50);                  // Limit base length

  const suffix = uuidv4().replace(/-/g, "").slice(0, 4);

  return `${base}-${suffix}`;
};