"use client";

import { Camera, Check } from "lucide-react";

const FEATURES = [
  "Deliver stunning private galleries in minutes",
  "Let clients hand-pick their favourites in real time",
  "Export selections straight to Lightroom & ZIP",
];

/**
 * Split-screen auth layout: an animated branded showcase on the left
 * (desktop only) and the form area on the right.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand showcase panel ─────────────────────────────────────── */}
      <aside className="brand-gradient relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* floating decorative blobs */}
        <div className="blob top-[-10%] left-[-5%] h-80 w-80 animate-float bg-white/30" />
        <div className="blob right-[-8%] bottom-[10%] h-96 w-96 animate-float-slow bg-fuchsia-300/40" />
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />

        {/* logo */}
        <div className="relative z-10 flex items-center gap-2.5 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
            <Camera className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">Proofly</span>
        </div>

        {/* headline + features */}
        <div className="relative z-10 max-w-md text-white">
          <h2 className="text-4xl font-bold leading-tight tracking-tight animate-fade-up">
            Your photos.
            <br />
            Their perfect pick.
          </h2>
          <p className="mt-4 text-base text-white/80 animate-fade-up [animation-delay:80ms]">
            The proofing workflow built for photographers who care about the
            details.
          </p>

          <ul className="mt-8 space-y-3.5">
            {FEATURES.map((feature, i) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm text-white/90 animate-fade-up"
                style={{ animationDelay: `${160 + i * 80}ms` }}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
                  <Check className="h-3 w-3" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* footer note */}
        <p className="relative z-10 text-sm text-white/60">
          Trusted by photographers to deliver every shot beautifully.
        </p>
      </aside>

      {/* ── Form panel ───────────────────────────────────────────────── */}
      <main className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:min-h-0">
        {/* soft accent glow behind the card on mobile/tablet */}
        <div className="blob top-[-15%] left-1/2 h-72 w-72 -translate-x-1/2 bg-brand/20 lg:hidden" />
        <div className="relative z-10 w-full max-w-md animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
