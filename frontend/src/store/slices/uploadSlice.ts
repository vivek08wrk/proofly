import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type UploadStatus = "idle" | "uploading" | "processing" | "done" | "error" | "cancelled";

interface UploadState {
  status: UploadStatus;
  progressPercent: number; // 0–100
  fileName: string | null;
  errorMessage: string | null;
  currentProjectId: string | null;
}

const initialState: UploadState = {
  status: "idle",
  progressPercent: 0,
  fileName: null,
  errorMessage: null,
  currentProjectId: null,
};

const uploadSlice = createSlice({
  name: "upload",
  initialState,
  reducers: {
    startUpload: (state, action: PayloadAction<{ fileName: string; projectId: string }>) => {
      state.status = "uploading";
      state.fileName = action.payload.fileName;
      state.progressPercent = 0;
      state.errorMessage = null;
      state.currentProjectId = action.payload.projectId;
    },
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.progressPercent = action.payload;
    },
    setProcessing: (state) => {
      state.status = "processing";
      state.progressPercent = 100;
    },
    setUploadDone: (state, action: PayloadAction<string>) => {
      state.status = "done";
      state.currentProjectId = action.payload;
    },
    setUploadError: (state, action: PayloadAction<string>) => {
      state.status = "error";
      state.errorMessage = action.payload;
    },
    resetUpload: (state) => {
      state.status = "idle";
      state.progressPercent = 0;
      state.fileName = null;
      state.errorMessage = null;
      state.currentProjectId = null;
    },
    cancelUpload: (state) => {
      state.status = "cancelled";
      state.errorMessage = "Upload cancelled by user";
    },
  },
});

export const {
  startUpload,
  setUploadProgress,
  setProcessing,
  setUploadDone,
  setUploadError,
  resetUpload,
  cancelUpload,
} = uploadSlice.actions;

export default uploadSlice.reducer;