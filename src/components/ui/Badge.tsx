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
          "bg-[#dcfce7] text-green-700 ring-1 ring-green-300": variant === "success",
          "bg-surface-overlay text-text-secondary ring-1 ring-border-strong": variant === "warning",
          "bg-[#fde8e8] text-red-700 ring-1 ring-red-300": variant === "danger",
          "bg-[#fce8f3] text-brand-700 ring-1 ring-brand-300": variant === "info",
          "bg-brand-gradient text-white shadow-sm": variant === "gradient",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
