import { Construction } from "lucide-react";

export function ComingSoon({ title, badge, message }: { title: string; badge: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card bg-surface p-12 text-center shadow-card">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-tint text-accent">
        <Construction size={24} />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className="rounded-pill bg-accent-tint px-3 py-1 text-xs font-semibold text-accent">{badge}</span>
        <h1 className="text-xl font-bold text-text-primary">{title}</h1>
      </div>
      <p className="max-w-md text-sm text-text-secondary">{message}</p>
    </div>
  );
}
