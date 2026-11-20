// Лекала: таза функциялар (базасыз) — кілт, жыл тексеруі, қорытынды.
import { canonicalMake } from "@/lib/domain/sales-ledger/normalize/car-make";
import { canonicalModel } from "@/lib/domain/sales-ledger/normalize/car-model";

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-яәіңғүұқөһ0-9]+/gi, "");

/** «тойота» + «Toyota камри 70» → { make: "Toyota", model: "Camry 70", key: "toyota|camry70" }. Бос болса — null. */
export function lekalaKey(rawMake: string | null | undefined, rawModel: string | null | undefined) {
  const make = canonicalMake(rawMake).trim();
  let model = canonicalModel(rawModel).trim();
  if (!make || !model) return null;
  // «Kia K5» → «K5» (модельдің басында марка қайталанса)
  if (model.toLowerCase().startsWith(make.toLowerCase() + " ")) model = model.slice(make.length + 1).trim();
  const k = norm(model);
  if (!k) return null;
  return { make, model, key: `${norm(make)}|${k}` };
}

export interface LekalaHistory {
  count: number;
  minYear: number | null;
  maxYear: number | null;
  last: string | null; // ISO күн
}

export type LekalaStatus = "have" | "check_year" | "none" | "asked";

export interface LekalaVerdict {
  status: LekalaStatus;
  count: number;
  years: string | null; // «2018–2024»
  last: string | null;
  source: "history" | "mark" | "request" | null;
  by: string | null;
}

export const yearsText = (h: Pick<LekalaHistory, "minYear" | "maxYear">) =>
  h.minYear == null ? null : h.minYear === h.maxYear ? String(h.minYear) : `${h.minYear}–${h.maxYear}`;

/**
 * Қорытынды: цех/CEO белгісі басым; әйтпесе тарих (бұрын тіктік → бар; бірақ жылы тігілген жылдардан 2+ жылға алыс болса — «жылын тексеріңіз»);
 * ешнәрсе жоқ, бірақ сұрау ашық болса — «сұралды».
 */
export function lekalaVerdict(
  hist: LekalaHistory | null,
  mark: { status: string; byName: string | null } | null,
  openRequest: { by: string | null } | null,
  year?: number | null,
): LekalaVerdict {
  const base = { count: hist?.count ?? 0, years: hist ? yearsText(hist) : null, last: hist?.last ?? null };
  if (mark?.status === "HAVE") return { ...base, status: "have", source: "mark", by: mark.byName };
  if (mark?.status === "NONE") return { ...base, status: openRequest ? "asked" : "none", source: openRequest ? "request" : "mark", by: openRequest?.by ?? mark.byName };
  if (hist && hist.count > 0) {
    const off = year != null && hist.minYear != null && hist.maxYear != null && (year < hist.minYear - 1 || year > hist.maxYear + 1);
    if (off && openRequest) return { ...base, status: "asked", source: "request", by: openRequest.by };
    return { ...base, status: off ? "check_year" : "have", source: "history", by: null };
  }
  if (openRequest) return { ...base, status: "asked", source: "request", by: openRequest.by };
  return { ...base, status: "none", source: null, by: null };
}

/**
 * Көліктің көзге анық атауы (цех беттері, CEO 2026-11-20): «хюндай» + «хюндай стария» → «Hyundai Stariya».
 * Марка/модель танылмаса — менеджер жазғаны (бас әріппен). raw — менеджердің өз жазуы (тексеру үшін).
 */
export function carTitle(rawMake: string | null | undefined, rawModel: string | null | undefined) {
  const k = lekalaKey(rawMake, rawModel);
  const raw = [rawMake, rawModel].map((s) => (s ?? "").trim()).filter(Boolean);
  const rawText = raw.length === 2 && raw[1].toLowerCase().includes(raw[0].toLowerCase()) ? raw[1] : raw.join(" ");
  if (k) return { make: k.make, model: k.model, title: `${k.make} ${k.model}`, raw: rawText };
  const cap = rawText.replace(/(^|\s)(\S)/g, (_m, a: string, b: string) => a + b.toUpperCase());
  return { make: "", model: "", title: cap, raw: rawText };
}

/**
 * Бұрын не тіккенбіз (CEO, 2026-11-20): Продажи «Товар» («3Д - Люкс - салон полный 2 ряд») → «3Д · салон полный 2 ряд».
 * Класс (Люкс/Премиум) лекалаға әсер етпейді — алынып тасталады. Код-тауарлар (Подпятник, Руль…) — лекаласыз, null.
 */
export function lekalaProductLabel(product: string | null | undefined): string | null {
  const parts = (product ?? "").split(" - ").map((s) => s.trim());
  const [type = "", cls = "", cover = ""] = parts;
  if (!parts.some(Boolean) || /^\d+$/.test(type)) return null;
  const t = type.toLowerCase();
  if (t === "багаж") return ["Багаж", cover].filter(Boolean).join(" · ");
  if (t === "съемный" || t === "съёмный") return ["Съёмный", cls, cover].filter(Boolean).join(" · ");
  if (type) return [type, cover].filter(Boolean).join(" · ");
  return [cls, cover].filter(Boolean).join(" · ") || null;
}

/** «Съёмный полик вид» («1041 - Леска - кара») → «Съёмный полик · Леска». */
export function lekalaMatLabel(matType: string | null | undefined): string | null {
  const kind = (matType ?? "").split(" - ").map((s) => s.trim())[1];
  return kind ? `+ Съёмный полик · ${kind}` : null;
}

export interface LekalaProduct {
  label: string;
  count: number;
  years: string | null;
  /** Жыл жазылса: осы жылға (±1) тіккенбіз бе */
  fitsYear: boolean | null;
}

/** Жинақтау: белгі → саны, жылдары. Көп тігілгені жоғарыда. */
export function summarizeProducts(
  items: Map<string, { count: number; minYear: number | null; maxYear: number | null }>,
  year?: number | null,
  limit = 8,
): LekalaProduct[] {
  return [...items.entries()]
    .map(([label, h]) => ({
      label,
      count: h.count,
      years: yearsText(h),
      fitsYear: year == null || h.minYear == null || h.maxYear == null ? null : year >= h.minYear - 1 && year <= h.maxYear + 1,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}
