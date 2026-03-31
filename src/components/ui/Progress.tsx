import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0-100
  color?: "green" | "yellow" | "red" | "brand";
  size?: "sm" | "md";
  className?: string;
}

export function Progress({ value, color = "brand", size = "md", className }: ProgressProps) {
  return (
    <div
      className={cn(
        "w-full rounded-full bg-surface-sunken overflow-hidden",
        size === "sm" ? "h-1.5" : "h-2.5",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", {
          "bg-green-500": color === "green",
          "bg-yellow-400": color === "yellow",
          "bg-red-500": color === "red",
          "bg-gradient-progress": color === "brand",
        })}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
