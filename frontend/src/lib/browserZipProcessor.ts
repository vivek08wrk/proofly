import JSZip from "jszip";
import imageCompression from "browser-image-compression";

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  originalFilename: string;
  sizeBytes: number;
  uploadOrder: number;
}

const supportedExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tiff",
  ".heic",
];

const isSupportedImagePath = (path: string): boolean => {
  const normalized = path.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();

  if (
    lower.startsWith("__macosx") ||
    lower.startsWith(".") ||
    lower.includes("/__macosx/") ||
    lower.includes("/.")
  ) {
    return false;
  }

  return supportedExtensions.some((ext) => lower.endsWith(ext));
};

const getImageDimensions = (blob: Blob): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image dimensions."));
    };
    img.src = url;
  });
};

const compressImage = async (blob: Blob, filename?: string): Promise<Blob> => {
  const file =
    blob instanceof File
      ? blob
      : new File([blob], filename ?? "image", {
          type: blob.type || "application/octet-stream",
        });

  return imageCompression(file, {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
  });
};

export const extractAndProcessZip = async (
  zipFile: File,
  onProgress: (current: number, total: number, filename: string) => void
): Promise<ProcessedImage[]> => {
  const zip = await JSZip.loadAsync(zipFile);

  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && isSupportedImagePath(entry.name)
  );

  const processed: ProcessedImage[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const originalFilename = entry.name.split("/").pop() ?? entry.name;
    onProgress(index + 1, entries.length, originalFilename);

    const blob = await entry.async("blob");
    const compressed = await compressImage(blob, originalFilename);
    const { width, height } = await getImageDimensions(compressed);

    processed.push({
      blob: compressed,
      width,
      height,
      originalFilename,
      sizeBytes: compressed.size,
      uploadOrder: index,
    });
  }

  return processed;
};

export const processIndividualImages = async (
  files: File[],
  onProgress: (current: number, total: number, filename: string) => void
): Promise<ProcessedImage[]> => {
  const processed: ProcessedImage[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    onProgress(index + 1, files.length, file.name);

    const compressed = await compressImage(file, file.name);
    const { width, height } = await getImageDimensions(compressed);

    processed.push({
      blob: compressed,
      width,
      height,
      originalFilename: file.name,
      sizeBytes: compressed.size,
      uploadOrder: index,
    });
  }

  return processed;
};
