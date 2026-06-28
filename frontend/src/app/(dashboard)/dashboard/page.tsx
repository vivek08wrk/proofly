"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAppDispatch } from "@/store/index";
import { resetUpload } from "@/store/slices/uploadSlice";
import { apiClient } from "@/lib/api";
import ProjectCard from "@/components/dashboard/ProjectCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Project } from "@/types/project";

// ─── Create Project Form Schema ────────────────────────────────────────────────

const createProjectSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").trim(),
  clientName: z.string().min(2, "Client name required").trim(),
  clientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
});

type CreateProjectForm = z.infer<typeof createProjectSchema>;

// ─── Page Component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
  });

  // ── Fetch Projects ──────────────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    try {
      setIsFetching(true);
      const res = await apiClient.get<{
        success: boolean;
        data: { projects: Project[] };
      }>("/projects");
      setProjects(res.data.data.projects);
    } catch {
      toast.error("Failed to load projects.");
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated, fetchProjects]);

  // ── Create Project ──────────────────────────────────────────────────────────

  const onCreateProject = async (values: CreateProjectForm) => {
    try {
      setIsCreating(true);
      const res = await apiClient.post<{
        success: boolean;
        data: { project: Project };
      }>("/projects", values);

      const newProject = res.data.data.project;
      setProjects((prev) => [newProject, ...prev]);
      setDialogOpen(false);
      reset();

      toast.success(
        "Project created!: Now upload your ZIP file to get started."
      );

      // Reset upload state and navigate to the new project
      dispatch(resetUpload());
      router.push(`/projects/${newProject.id}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? "Failed to create project.");
    } finally {
      setIsCreating(false);
    }
  };

  // ── Delete Project ──────────────────────────────────────────────────────────

  const handleDeleteProject = async (projectId: string) => {
    if (!projectId) {
      toast.error("Invalid project ID");
      return;
    }
    try {
      await apiClient.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      dispatch(resetUpload());
      toast.success(
        "Project deleted: All photos and data have been removed."
      );
    } catch {
      toast.error("Could not delete the project. Please try again.");
    }
  };

  // ── Loading State ───────────────────────────────────────────────────────────

  if (authLoading || isFetching) {
    return <LoadingSpinner fullScreen />;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Your <span className="text-brand-gradient">Projects</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {projects.length > 0
              ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
              : "No projects yet — create your first one"}
          </p>
        </div>

        {/* Create Project Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="brand-gradient h-10 w-full gap-2 px-4 font-semibold text-white shadow-brand transition-all hover:opacity-95 hover:shadow-lg sm:w-auto">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Enter the project details. You can upload photos after creation.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleSubmit(onCreateProject)}
              className="space-y-4 mt-2"
            >
              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  placeholder="Sarah & John Wedding 2026"
                  disabled={isCreating}
                  {...register("title")}
                  className={errors.title ? "border-destructive" : ""}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  placeholder="Sarah Johnson"
                  disabled={isCreating}
                  {...register("clientName")}
                  className={errors.clientName ? "border-destructive" : ""}
                />
                {errors.clientName && (
                  <p className="text-xs text-destructive">
                    {errors.clientName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientEmail">
                  Client Email{" "}
                  <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="clientEmail"
                  type="email"
                  placeholder="sarah@example.com"
                  disabled={isCreating}
                  {...register("clientEmail")}
                  className={errors.clientEmail ? "border-destructive" : ""}
                />
                {errors.clientEmail && (
                  <p className="text-xs text-destructive">
                    {errors.clientEmail.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDialogOpen(false);
                    reset();
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-24 text-center animate-fade-up">
          <div className="brand-gradient mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-brand">
            <FolderOpen className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            No projects yet
          </h3>
          <p className="text-muted-foreground text-sm mt-1.5 max-w-xs">
            Create your first project to start delivering stunning galleries to
            your clients.
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            className="brand-gradient mt-6 h-10 gap-2 px-4 font-semibold text-white shadow-brand transition-all hover:opacity-95 hover:shadow-lg"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <ProjectCard project={project} onDelete={handleDeleteProject} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}