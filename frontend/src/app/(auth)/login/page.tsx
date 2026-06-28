"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertCircle, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import AuthShell from "@/components/auth/AuthShell";
import { useAppDispatch, useAppSelector } from "@/store/index";
import { loginUser, clearAuthError } from "@/store/slices/authSlice";

// ─── Validation Schema ─────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error, isAuthenticated } = useAppSelector(
    (state) => state.auth
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const onSubmit = async (values: LoginFormValues) => {
    await dispatch(loginUser(values));
  };

  return (
    <AuthShell>
      <div className="glass shadow-soft rounded-2xl border border-border/60 p-7 sm:p-9">
        {/* Heading */}
        <div className="mb-7">
          <span className="inline-flex items-center rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-medium text-brand">
            Welcome back
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sign in to Proofly
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pick up right where you left off.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Server-side error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 animate-fade-in">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

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
              placeholder="••••••••"
              autoComplete="current-password"
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

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="brand-gradient group h-11 w-full text-base font-semibold text-brand-foreground shadow-brand transition-all hover:opacity-95 hover:shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-brand underline-offset-4 transition-colors hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}