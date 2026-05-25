import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Photo } from "@/types/project";

interface GalleryState {
  photos: Photo[];
  selectedPhotoIds: string[];
  isLoading: boolean;
  error: string | null;
  lightboxIndex: number | null; // null = closed, number = open at index
}

const initialState: GalleryState = {
  photos: [],
  selectedPhotoIds: [],
  isLoading: false,
  error: null,
  lightboxIndex: null,
};

const gallerySlice = createSlice({
  name: "gallery",
  initialState,
  reducers: {
    setPhotos: (state, action: PayloadAction<Photo[]>) => {
      state.photos = action.payload;
    },
    togglePhotoSelection: (state, action: PayloadAction<string>) => {
      const photoId = action.payload;
      const index = state.selectedPhotoIds.indexOf(photoId);
      if (index === -1) {
        state.selectedPhotoIds.push(photoId);
      } else {
        state.selectedPhotoIds.splice(index, 1);
      }
    },
    setSelections: (state, action: PayloadAction<string[]>) => {
      // Used to sync selections received from Socket.IO
      state.selectedPhotoIds = action.payload;
    },
    clearSelections: (state) => {
      state.selectedPhotoIds = [];
    },
    openLightbox: (state, action: PayloadAction<number>) => {
      state.lightboxIndex = action.payload;
    },
    closeLightbox: (state) => {
      state.lightboxIndex = null;
    },
    setGalleryLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setGalleryError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setPhotos,
  togglePhotoSelection,
  setSelections,
  clearSelections,
  openLightbox,
  closeLightbox,
  setGalleryLoading,
  setGalleryError,
} = gallerySlice.actions;

export default gallerySlice.reducer;