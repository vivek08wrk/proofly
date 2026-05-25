import axios from "axios";

/**
 * Axios instance pre-configured for our backend.
 * withCredentials: true — sends httpOnly cookies with every request.
 * This is what makes our cookie-based auth work from the browser.
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor — attach localStorage token as fallback
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("proofly_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — handles global error cases
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const err = error as {
      response?: { status?: number };
      config?: { url?: string };
    };

    // If 401 and not on auth routes — session expired
    if (
      err.response?.status === 401 &&
      !err.config?.url?.includes("/auth/")
    ) {
      // Redirect to login — handled by the calling component
      if (typeof window !== "undefined") {
        localStorage.removeItem("proofly_token");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);