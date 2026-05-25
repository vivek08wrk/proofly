export interface Photo {
  id: string;
  projectId: string;
  originalFilename: string;
  previewUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  uploadOrder: number;
}

export type ProjectStatus = "processing" | "ready" | "error";

export interface Project {
  id: string;
  photographerId: string;
  title: string;
  slug: string;
  clientName: string;
  clientEmail?: string;
  coverImageUrl?: string | null;
  totalPhotos: number;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SelectionState {
  id: string;
  projectId: string;
  clientName: string;
  selectedPhotoIds: string[];
  totalSelected: number;
  lastUpdatedAt: string;
}