import { cn } from "@/lib/utils";

/** Shimmering placeholder block. Pass sizing/rounding via className. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("skeleton rounded-md", className)} {...props} />
  );
}

export { Skeleton };
