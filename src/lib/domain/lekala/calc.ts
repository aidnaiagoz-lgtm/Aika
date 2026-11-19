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
