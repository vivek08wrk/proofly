import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/app/providers";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Proofly — Client Gallery & Proofing",
    template: "%s | Proofly",
  },
  description:
    "Professional photographer client gallery and photo selection platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}