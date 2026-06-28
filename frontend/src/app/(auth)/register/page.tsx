"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertCircle, ArrowRight, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import AuthShell from "@/components/auth/AuthShell";
import { useAppDispatch, useAppSelector } from "@/store/index";
import { registerUser, clearAuthError } from "@/store/slices/authSlice";

// ─── Validation Schema ─────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name too long"),
    email: z.string().email("Please enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error, isAuthenticated } = useAppSelector(
    (state) => state.auth
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const onSubmit = async (values: RegisterFormValues) => {
    await dispatch(
      registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
      })
    );
  };

  return (
    <AuthShell>
      <div className="glass shadow-soft rounded-2xl border border-border/60 p-7 sm:p-9">
        {/* Heading */}
        <div className="mb-7">
          <span className="inline-flex items-center rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-medium text-brand">
            Get started free
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Start delivering stunning galleries to your clients.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Server error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 animate-fade-in">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="Alex Johnson"
                autoComplete="name"
                disabled={isLoading}
                {...register("name")}
                className={`h-11 pl-9 ${errors.name ? "border-destructive" : ""}`}
              />
            </div>
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@studio.com"
                autoComplete="email"
                disabled={isLoading}
                {...register("email")}
                className={`h-11 pl-9 ${errors.email ? "border-destructive" : ""}`}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              disabled={isLoading}
              {...register("password")}
              className={`h-11 ${errors.password ? "border-destructive" : ""}`}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Repeat your password"
              autoComplete="new-password"
              disabled={isLoading}
              {...register("confirmPassword")}
              className={`h-11 ${
                errors.confirmPassword ? "border-destructive" : ""
              }`}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="brand-gradient group h-11 w-full text-base font-semibold text-brand-foreground shadow-brand transition-all hover:opacity-95 hover:shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand underline-offset-4 transition-colors hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}