"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/index";
import { fetchCurrentUser } from "@/store/slices/authSlice";

/**
 * Hook to restore auth state from the server cookie on page load.
 * Calls /api/auth/me — if cookie is valid, populates Redux store.
 * If cookie is invalid/expired, redirects to login.
 */
export const useAuth = (redirectIfUnauthenticated = true) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth
  );

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      dispatch(fetchCurrentUser()).then((result) => {
        if (
          result.meta.requestStatus === "rejected" &&
          redirectIfUnauthenticated
        ) {
          router.replace("/login");
        }
      });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return { user, isAuthenticated, isLoading };
};