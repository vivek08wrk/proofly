import sharp from "sharp";

export interface OptimizedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
}

/**
 * Optimizes a raw image buffer using Sharp.
 *
 * Strategy:
 * - Resize to max 2000px on the longest edge (preserves aspect ratio)
 * - Convert to JPEG at 80% quality
 * - Strip EXIF metadata (privacy + file size reduction)
 * - Progressive JPEG encoding (browser renders progressively — feels faster)
 *
 * Typical results: 8MB RAW → ~400KB optimized (95% size reduction)
 */
export const optimizeImage = async (
  inputBuffer: Buffer
): Promise<OptimizedImageResult> => {
  const pipeline = sharp(inputBuffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .resize({
      width: 2000,
      height: 2000,
      fit: "inside",            // Never upscale — only downscale if larger
      withoutEnlargement: true, // Small images stay small
    })
    .jpeg({
      quality: 80,
      progressive: true,        // Progressive JPEG for faster perceived load
      mozjpeg: true,            // Better compression algorithm
    })
    .withMetadata(false);       // Strip ALL metadata (EXIF, GPS, etc.)

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    sizeBytes: info.size,
    format: info.format,
  };
};

/**
 * Checks if a filename is a supported image format.
 * Filters out hidden files (__MACOSX), thumbnails, etc.
 */
export const isSupportedImageFile = (filename: string): boolean => {
  // Skip macOS metadata folders and hidden files
  if (
    filename.startsWith("__MACOSX") ||
    filename.startsWith(".") ||
    filename.includes("/__MACOSX/") ||
    filename.includes("/.")
  ) {
    return false;
  }

  const supportedExtensions = /\.(jpg|jpeg|png|webp|tiff|tif|heic|heif)$/i;
  return supportedExtensions.test(filename);
};