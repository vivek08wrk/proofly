import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import authReducer from "@/store/slices/authSlice";
import galleryReducer from "@/store/slices/gallerySlice";
import uploadReducer from "@/store/slices/uploadSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    gallery: galleryReducer,
    upload: uploadReducer,
  },
  // Redux DevTools is automatically enabled in development
  devTools: process.env.NODE_ENV !== "production",
});

// Infer RootState and AppDispatch types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Typed hooks — use these throughout the app instead of plain
 * useDispatch and useSelector for full TypeScript inference.
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;