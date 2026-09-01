import { cn } from "@/lib/utils";

export const APP_NAME = "IASPOR";

export function BrandMark({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "banner";
  className?: string;
}) {
  if (variant === "banner") {
    return (
      <p
        className={cn(
          "wordmark font-display leading-none text-4xl tracking-[0.22em] text-primary uppercase sm:text-5xl",
          className,
        )}
        aria-label={APP_NAME}
      >
        {APP_NAME}
      </p>
    );
  }

  return (
    <img
      src="/logo.jpg"
      alt={APP_NAME}
      className={cn(
        "size-12 rounded-md object-cover ring-1 ring-primary/40",
        className,
      )}
    />
  );
}
