import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-caution-400",
  red: "bg-red-500",
  gray: "bg-text-tertiary",
};

interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  color: "green" | "yellow" | "red" | "gray";
}

export function StatusDot({ color, className, ...props }: StatusDotProps) {
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", COLOR_MAP[color], className)}
      {...props}
    />
  );
}
