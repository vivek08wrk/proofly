import type { AxiosInstance } from "axios";

export const getPreviewPresignedUrl = async (
  projectId: string,
  filename: string,
  apiClient: AxiosInstance
): Promise<{
  presignedUrl: string;
  previewKey: string;
  previewUrl: string;
  originalPresignedUrl: string;
  originalKey: string;
}> => {
  const response = await apiClient.get<{
    success: true;
    data: {
      presignedUrl: string;
      previewKey: string;
      previewUrl: string;
      originalPresignedUrl: string;
      originalKey: string;
    };
  }>(`/upload/${projectId}/preview-url`, {
    params: {
      filename,
    },
  });

  return response.data.data;
};

export const uploadBlobToR2 = async (
  presignedUrl: string,
  blob: Blob,
  onProgress?: (percent: number) => void,
  contentType: string = "image/jpeg"
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress?.(percent);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(blob);
  });
};

export const savePhotoMetadata = async (
  projectId: string,
  photoData: {
    originalFilename: string;
    previewUrl: string;
    previewKey: string;
    originalKey: string;
    width: number;
    height: number;
    sizeBytes: number;
    uploadOrder: number;
    isLast: boolean;
    totalPhotos: number;
  },
  apiClient: AxiosInstance
): Promise<void> => {
  await apiClient.post(`/upload/${projectId}/save-photo`, photoData);
};
