"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Project } from "@/types/project";
import { apiClient } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get<{
          success: boolean;
          data: { project: Project };
        }>(`/projects/${projectId}`);
        setProject(response.data.data.project);
        setError(null);
      } catch (err) {
        const error = err as { response?: { data?: { message?: string } } };
        const errorMessage =
          error.response?.data?.message ?? "Failed to load project";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">
            {error ? "Error Loading Project" : "Project Not Found"}
          </h1>
          <p className="text-muted-foreground mb-4">
            {error ??
              "The project you're looking for doesn't exist or has been deleted."}
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button
          onClick={() => router.push("/dashboard")}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{project.title}</h1>
          <div className="flex flex-wrap gap-4 text-muted-foreground">
            <div>
              <span className="font-semibold">Client:</span> {project.clientName}
            </div>
            {project.clientEmail && (
              <div>
                <span className="font-semibold">Email:</span>{" "}
                {project.clientEmail}
              </div>
            )}
            <div>
              <span className="font-semibold">Photos:</span>{" "}
              {project.totalPhotos}
            </div>
            <div>
              <span className="font-semibold">Status:</span>{" "}
              <span className="capitalize">{project.status}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Project Details</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Project Slug</p>
              <p className="font-mono bg-muted p-2 rounded">{project.slug}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p>{new Date(project.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p>{new Date(project.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {project.status === "processing" && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              This project is currently being processed. Gallery and selections
              will be available once processing is complete.
            </p>
          </div>
        )}

        {project.status === "error" && (
          <div className="mt-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-900 dark:text-red-100">
              There was an error processing this project. Please contact support
              if this issue persists.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
