import type { MaterialCategory } from "@prisma/client";
import { swatchColor } from "@/lib/domain/workshop/calc";
import { PhotoZoom } from "./PhotoZoom";
import type { StockStatus } from "@/lib/domain/warehouse/stock-calc";
import type { Locale } from "@/lib/i18n";
import { WH } from "./t";

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

/** Фото бар болса — кішкене сурет (тышқанды апарса үлкейеді), жоқ болса — түс дөңгелегі. */
export function Thumb({ name, photo, size = 40 }: { name: string; photo: string | null; size?: number }) {
  if (!photo) return <Dot name={name} />;
  return <PhotoZoom src={photo} alt={name} size={size} className="mr-3" />;
}

const STATUS_CLS: Record<StockStatus, string> = {
  ok: "bg-page-bg text-text-secondary",
  order: "bg-[#fff4e0] text-[#b45309]",
  urgent: "bg-danger/10 text-danger",
  low: "bg-[#fff4e0] text-[#b45309]",
  out: "bg-danger/10 text-danger",
  none: "bg-page-bg text-text-secondary/70",
};

export function StatusPill({ s, locale }: { s: StockStatus; locale: Locale }) {
  return <span className={`whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[s]}`}>{WH[locale].status[s]}</span>;
}

export const CATEGORY_ORDER: MaterialCategory[] = ["LEATHER", "THREAD", "EDGING", "EVA", "FISHING_LINE", "CARPET", "ACCESSORIES"];

const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Asia/Almaty" });
const almaty = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
/** «Бүгін» / «Кеше» / «16.11» (орысша: «Сегодня» / «Вчера») */
export function relDay(iso: string, locale: Locale = "kk", now = new Date()) {
  const d = new Date(iso);
  const k = almaty(d);
  if (k === almaty(now)) return WH[locale].today;
  if (k === almaty(new Date(now.getTime() - 86400_000))) return WH[locale].yesterday;
  return day.format(d);
}
