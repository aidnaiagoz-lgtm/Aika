import type { MaterialCategory } from "@prisma/client";
import { swatchColor } from "@/lib/domain/workshop/calc";
import type { StockStatus } from "@/lib/domain/warehouse/stock-calc";

/** Материалдың түсі — кішкене дөңгелек (атауынан; табылмаса — сұр сызықты). */
export function Dot({ name }: { name: string }) {
  const c = swatchColor(name);
  return (
    <span
      className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-[1px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
      style={{ background: c ?? "repeating-linear-gradient(45deg,#e5e7eb 0 2px,#f8fafc 2px 4px)" }}
    />
  );
}

export const STATUS: Record<StockStatus, { label: string; cls: string }> = {
  ok: { label: "Жеткілікті", cls: "bg-page-bg text-text-secondary" },
  low: { label: "Аз қалды", cls: "bg-[#fff4e0] text-[#b45309]" },
  out: { label: "Бітті", cls: "bg-danger/10 text-danger" },
  none: { label: "Кіріс болмаған", cls: "bg-page-bg text-text-secondary/70" },
};

export function StatusPill({ s }: { s: StockStatus }) {
  return <span className={`whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-semibold ${STATUS[s].cls}`}>{STATUS[s].label}</span>;
}

export const CATEGORY_ORDER: MaterialCategory[] = ["LEATHER", "THREAD", "EDGING", "EVA", "FISHING_LINE", "CARPET", "ACCESSORIES"];

const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Asia/Almaty" });
const almaty = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
/** «Бүгін» / «Кеше» / «16.11» */
export function relDay(iso: string, now = new Date()) {
  const d = new Date(iso);
  const k = almaty(d);
  if (k === almaty(now)) return "Бүгін";
  if (k === almaty(new Date(now.getTime() - 86400_000))) return "Кеше";
  return day.format(d);
}
