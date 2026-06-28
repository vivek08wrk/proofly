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
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { Project, Photo, SelectionState } from "@/types/project";
import UploadZone from "@/components/dashboard/UploadZone";
import SelectionPanel from "@/components/dashboard/SelectionPanel";
import DownloadPanel from "@/components/dashboard/DownloadPanel";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(galleryUrl);
    setCopied(true);
    toast.success("Gallery link copied.");
    setTimeout(() => setCopied(false), 1800);
  };

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
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl col-span-2 sm:col-span-1" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {project.title}
            </h1>
            <Badge
              variant="outline"
              className={`gap-1.5 capitalize ${
                project.status === "ready"
                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : project.status === "processing"
                  ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  project.status === "ready"
                    ? "bg-green-500"
                    : project.status === "processing"
                    ? "animate-pulse bg-yellow-500"
                    : "bg-destructive"
                }`}
              />
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
          <Button asChild variant="brand" className="h-10 gap-2 px-4 shrink-0">
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
          <div className="group rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-soft">
            <div className="flex items-center gap-3">
              <span className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-brand">
                <Images className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold leading-none text-foreground tabular-nums">
                  {project.totalPhotos}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Total Photos</p>
              </div>
            </div>
          </div>

          <div className="group rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-soft">
            <div className="flex items-center gap-3">
              <span className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-brand">
                <CheckSquare className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold leading-none text-foreground tabular-nums">
                  {selection?.totalSelected ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Client Selected
                </p>
              </div>
            </div>
          </div>

          <div className="col-span-2 space-y-2.5 rounded-xl border border-border/50 bg-card p-5 sm:col-span-1">
            <p className="text-xs font-medium text-muted-foreground">
              Gallery Link
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5">
              <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <a
                href={galleryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-xs text-brand hover:underline"
              >
                {galleryUrl}
              </a>
            </div>
            <Button
              type="button"
              variant={copied ? "secondary" : "outline"}
              size="sm"
              className="w-full gap-2"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
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
                className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-transparent transition-all duration-300 hover:ring-brand/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={photo.originalFilename}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            ))}
            {photos.length > 24 && (
              <Link
                href={`/gallery/${project.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                key="more"
                className="flex aspect-square items-center justify-center rounded-lg bg-muted text-center transition-colors hover:bg-brand/10"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  +{photos.length - 24}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}