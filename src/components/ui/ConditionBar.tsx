import { cn } from "@/lib/utils";

interface ConditionBarProps {
  label: string;
  score: number | null;
  maxScore?: number;
  subtitle?: string;
  className?: string;
}

export function ConditionBar({ label, score, maxScore = 100, subtitle, className }: ConditionBarProps) {
  const pct = score != null ? (score / maxScore) * 100 : 0;
  const fillColor =
    (score ?? 0) >= 70 ? "bg-green-500" :
    (score ?? 0) >= 50 ? "bg-caution-400" :
    "bg-red-500";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm font-bold text-text-primary tabular-nums">
          {score ?? "—"}<span className="text-text-tertiary font-normal">/{maxScore}</span>
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-surface-sunken overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", fillColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {subtitle && (
        <p className="text-xs text-text-secondary leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
