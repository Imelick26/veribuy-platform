import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "gradient";
  children: React.ReactNode;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-surface-overlay text-text-secondary": variant === "default",
          "text-green-700 ring-1 ring-green-300": variant === "success",
          "text-amber-700 ring-1 ring-amber-300": variant === "warning",
          "text-red-700 ring-1 ring-red-300": variant === "danger",
          "text-text-secondary ring-1 ring-border-strong": variant === "info",
          "bg-text-primary text-white": variant === "gradient",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
