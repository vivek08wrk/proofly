import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { apiClient } from "@/lib/api";
import { AuthUser, ApiResponse } from "@/types/api";

// ─── State Interface ───────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// ─── Async Thunks ──────────────────────────────────────────────────────────────

export const registerUser = createAsyncThunk<
  AuthUser,
  { name: string; email: string; password: string },
  { rejectValue: string }
>("auth/register", async (credentials, { rejectWithValue }) => {
  try {
    const response = await apiClient.post<
      ApiResponse<{ user: AuthUser; token?: string }>
    >(
      "/auth/register",
      credentials
    );

    if (typeof window !== "undefined" && response.data.data.token) {
      localStorage.setItem("proofly_token", response.data.data.token);
    }
    return response.data.data.user;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } };
    return rejectWithValue(
      err.response?.data?.message ?? "Registration failed. Please try again."
    );
  }
});

export const loginUser = createAsyncThunk<
  AuthUser,
  { email: string; password: string },
  { rejectValue: string }
>("auth/login", async (credentials, { rejectWithValue }) => {
  try {
    const response = await apiClient.post<
      ApiResponse<{ user: AuthUser; token?: string }>
    >(
      "/auth/login",
      credentials
    );

    if (typeof window !== "undefined" && response.data.data.token) {
      localStorage.setItem("proofly_token", response.data.data.token);
    }
    return response.data.data.user;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } };
    return rejectWithValue(
      err.response?.data?.message ?? "Login failed. Please check your credentials."
    );
  }
});

export const logoutUser = createAsyncThunk<void, void, { rejectValue: string }>(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await apiClient.post("/auth/logout");
      if (typeof window !== "undefined") {
        localStorage.removeItem("proofly_token");
      }
    } catch (error: unknown) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("proofly_token");
      }
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? "Logout failed."
      );
    }
  }
);

export const fetchCurrentUser = createAsyncThunk<
  AuthUser,
  void,
  { rejectValue: string }
>("auth/fetchMe", async (_, { rejectWithValue }) => {
  try {
    const response = await apiClient.get<ApiResponse<{ user: AuthUser }>>(
      "/auth/me"
    );
    return response.data.data.user;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } };
    return rejectWithValue(
      err.response?.data?.message ?? "Session expired."
    );
  }
});

// ─── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Synchronous action to clear errors
    clearAuthError: (state) => {
      state.error = null;
    },
    // Synchronous action to reset auth state (used on logout)
    resetAuthState: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ── Register ──
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action: PayloadAction<AuthUser>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? "Registration failed.";
      });

    // ── Login ──
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<AuthUser>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? "Login failed.";
      });

    // ── Logout ──
    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      });

    // ── Fetch Current User ──
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action: PayloadAction<AuthUser>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
      });
  },
});

export const { clearAuthError, resetAuthState } = authSlice.actions;
export default authSlice.reducer;