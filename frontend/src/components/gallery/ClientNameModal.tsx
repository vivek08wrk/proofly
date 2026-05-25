"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClientNameModalProps {
  isOpen: boolean;
  defaultName: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

const schema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name too long")
    .trim(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Modal that asks the client for their name before
 * they can start selecting photos.
 *
 * Pre-fills with the project's clientName as a hint.
 * Name is stored in component state — used for all
 * subsequent selection API calls.
 */
export default function ClientNameModal({
  isOpen,
  defaultName,
  onSubmit,
  onClose,
}: ClientNameModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Pre-fill with project client name
  useEffect(() => {
    if (isOpen && defaultName) {
      setValue("name", defaultName);
    }
  }, [isOpen, defaultName, setValue]);

  if (!isOpen) return null;

  const onFormSubmit = (values: FormValues) => {
    onSubmit(values.name);
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Modal Card */}
      <div
        className="w-full sm:max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <User className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Welcome to your gallery!
          </h2>
          <p className="text-sm text-muted-foreground">
            Confirm your name to start selecting photos.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="clientName">Your Name</Label>
            <Input
              id="clientName"
              placeholder="Enter your name"
              autoFocus
              {...register("name")}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full">
            Start Selecting
          </Button>
        </form>
      </div>
    </div>
  );
}