"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Images,
  CheckSquare,
  Trash2,
  ExternalLink,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Project } from "@/types/project";

interface ProjectCardProps {
  project: Project;
  onDelete: (projectId: string) => Promise<void>;
}

const statusConfig = {
  processing: {
    label: "Processing",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  ready: {
    label: "Ready",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  error: {
    label: "Error",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    await onDelete(project.id);
    setIsDeleting(false);
    setShowConfirm(false);
  };

  const formattedDate = new Date(project.createdAt).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric" }
  );

  const status = statusConfig[project.status];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-soft">
      {/* Cover Image / Placeholder */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {project.coverImageUrl ? (
          <Image
            src={project.coverImageUrl}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Images className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-3 left-3">
          <Badge
            variant="outline"
            className={cn("text-xs font-medium backdrop-blur-sm", status.className)}
          >
            {project.status === "processing" && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-3">
        {/* Title + Client */}
        <div>
          <h3 className="font-semibold text-foreground truncate leading-tight">
            {project.title}
          </h3>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {project.clientName}
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Images className="h-3.5 w-3.5" />
            {project.totalPhotos} photos
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formattedDate}
          </span>
        </div>

        {/* Actions */}
        {!showConfirm ? (
          <div className="flex items-center gap-2 pt-1">
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="flex-1 gap-1.5"
              disabled={project.status !== "ready"}
            >
              <Link href={`/projects/${project.id}`}>
                <CheckSquare className="h-3.5 w-3.5" />
                Manage
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={project.status !== "ready"}
            >
              <Link
                href={`/gallery/${project.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Gallery
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          /* Confirm Delete UI */
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground text-center">
              Delete project and all photos?
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Yes, delete"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}