import { Metadata } from "next";
import GalleryClient from "./GalleryClient";

interface GalleryPageProps {
  params: Promise<{ gallerySlug: string }>;
}

/**
 * Server Component wrapper — fetches metadata for SEO.
 * Actual interactive gallery is in GalleryClient (Client Component).
 */
export async function generateMetadata({
  params,
}: GalleryPageProps): Promise<Metadata> {
  const { gallerySlug } = await params;

  return {
    title: `Photo Gallery — ${gallerySlug}`,
    description: "Your personal photo gallery. Select your favorite photos.",
  };
}

export default async function GalleryPage({
  params,
}: GalleryPageProps) {
  const { gallerySlug } = await params;
  return <GalleryClient gallerySlug={gallerySlug} />;
}