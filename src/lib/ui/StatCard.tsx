import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  deltaPct,
  deltaLabel,
  icon: Icon,
  tint = "accent",
  compact = false,
}: {
  label: string;
  value: string;
  deltaPct?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  tint?: "accent" | "blue";
  compact?: boolean;
}) {
  const tintClasses = tint === "blue" ? "bg-status-new/10 text-status-new" : "bg-accent-tint text-accent";

  return (
    <div className={`shadow-card rounded-card bg-surface ${compact ? "p-4" : "p-5"} flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span>
        {Icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-icon ${tintClasses}`}>
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={`font-bold tabular-nums text-text-primary ${compact ? "text-xl" : "text-2xl"}`}>{value}</div>
      {deltaPct !== undefined && (
        <div className="flex items-center gap-1 text-xs font-semibold text-status-success">
          <span>↑ {deltaPct}%</span>
          {deltaLabel && <span className="font-normal text-text-secondary">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
