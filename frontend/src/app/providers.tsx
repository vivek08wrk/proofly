"use client";

import { ReactNode } from "react";
import { Provider } from "react-redux";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { store } from "@/store/index";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Wraps the entire app with required context providers.
 * Extracted into its own file because root layout.tsx is a Server Component —
 * Redux Provider and ThemeProvider are client-side only.
 */
export default function Providers({ children }: ProvidersProps) {
  return (
    <Provider store={store}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
        <Toaster position="bottom-right" richColors />
      </ThemeProvider>
    </Provider>
  );
}