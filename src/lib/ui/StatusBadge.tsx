export type StatusTone = "new" | "processing" | "shipping" | "success" | "neutral" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  new: "bg-status-new/10 text-status-new",
  processing: "bg-status-processing/10 text-status-processing",
  shipping: "bg-status-shipping/10 text-status-shipping",
  success: "bg-status-success/10 text-status-success",
  neutral: "bg-status-neutral/15 text-text-secondary",
  danger: "bg-danger/10 text-danger",
};

export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
