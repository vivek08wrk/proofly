"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link"; import { useAppDispatch } from "@/store/index";
 import { resetUpload } from "@/store/slices/uploadSlice";import {
  ArrowLeft,
  ExternalLink,
  Images,
  CheckSquare,
  Calendar,
  Link as LinkIcon,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { Project, Photo, SelectionState } from "@/types/project";
import UploadZone from "@/components/dashboard/UploadZone";
import SelectionPanel from "@/components/dashboard/SelectionPanel";
import DownloadPanel from "@/components/dashboard/DownloadPanel";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";

interface ProjectDetailData {
  project: Project;
  photos: Photo[];
  selection: SelectionState | null;
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<ProjectDetailData | null>(
    null
  );
  const [isFetching, setIsFetching] = useState(true);
  const [galleryUrl, setGalleryUrl] = useState("");

  useEffect(() => {
    // Reset upload state when projectId changes
    dispatch(resetUpload());
  }, [projectId, dispatch]);

  useEffect(() => {
    if (!isAuthenticated || !projectId) return;

    const fetchProject = async () => {
      try {
        setIsFetching(true);
        const res = await apiClient.get<{
          success: boolean;
          data: ProjectDetailData;
        }>(`/projects/${projectId}`);
        setData(res.data.data);
      } catch {
        toast.error("Failed to load project.");
        router.replace("/dashboard");
      } finally {
        setIsFetching(false);
      }
    };

    fetchProject();
  }, [isAuthenticated, projectId, router]);

  useEffect(() => {
    if (!data) return;
    if (typeof window !== "undefined") {
      setGalleryUrl(
        `${window.location.origin}/gallery/${data.project.slug}`
      );
    }
  }, [data]);

  if (authLoading || isFetching) {
    return <LoadingSpinner fullScreen />;
  }

  if (!data) return null;

  const { project, photos, selection } = data;

  const formattedDate = new Date(
    project.createdAt
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
      >
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          All Projects
        </Link>
      </Button>

      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              {project.title}
            </h1>
            <Badge
              variant="outline"
              className={
                project.status === "ready"
                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : project.status === "processing"
                  ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              }
            >
              {project.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span>Client: {project.clientName}</span>
            {project.clientEmail && (
              <span>{project.clientEmail}</span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
          </div>
        </div>

        {project.status === "ready" && (
          <Button
            asChild
            variant="outline"
            className="gap-2 shrink-0"
          >
            <Link
              href={`/gallery/${project.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              View Client Gallery
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Row */}
      {project.status === "ready" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border/50 rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted-foreground">
              Total Photos
            </p>
            <p className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Images className="h-5 w-5 text-muted-foreground" />
              {project.totalPhotos}
            </p>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted-foreground">
              Client Selected
            </p>
            <p className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-muted-foreground" />
              {selection?.totalSelected ?? 0}
            </p>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-4 space-y-2 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">
              Gallery Link
            </p>
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <a
                href={galleryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-primary truncate hover:underline"
              >
                {galleryUrl}
              </a>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(galleryUrl);
                toast.success("Gallery link copied.");
              }}
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      {project.status !== "ready" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Upload Photos
          </h2>
          <UploadZone projectId={project.id} />
        </div>
      )}

      {/* Two column layout for selections + downloads */}
      {project.status === "ready" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Selection Panel */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Client Selections
            </h2>
            <SelectionPanel
              projectId={project.id}
              initialSelection={
                selection ?? {
                  id: "",
                  projectId: project.id,
                  clientName: project.clientName,
                  selectedPhotoIds: [],
                  totalSelected: 0,
                  lastUpdatedAt: new Date().toISOString(),
                }
              }
              photos={photos}
            />
          </div>

          {/* Download Panel */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Download
            </h2>
            <DownloadPanel
              projectId={project.id}
              projectSlug={project.slug}
              totalSelected={selection?.totalSelected ?? 0}
              selectedPhotos={
                photos.filter((photo) =>
                  selection?.selectedPhotoIds.includes(photo.id)
                )
              }
            />
          </div>
        </div>
      )}

      {/* Photos Preview Grid */}
      {project.status === "ready" && photos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Photos ({photos.length})
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {photos.slice(0, 24).map((photo, index) => (
              <div
                key={`${index}-${photo.id}`}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={photo.originalFilename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {photos.length > 24 && (
              <div
                key="more"
                className="aspect-square rounded-lg bg-muted flex items-center justify-center"
              >
                <span className="text-sm text-muted-foreground font-medium">
                  +{photos.length - 24}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}