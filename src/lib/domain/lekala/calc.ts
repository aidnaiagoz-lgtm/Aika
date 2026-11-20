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
  const parts = (product ?? "").split(" - ").map((s) => s.trim().replace(/^-+$/, ""));
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
  /** Соңғы рет тігілген күн (ISO) */
  last: string | null;
}

export interface LekalaGroup {
  id: string;
  /** «XU70 · 2019–қазір», «2023–2025 (±1)», «Басқа жылдар», «Жылы жазылмаған», «Барлық жылдар» */
  title: string;
  count: number;
  last: string | null;
  /** Менеджер жазған жыл осы топқа кіреді */
  current: boolean;
  products: LekalaProduct[];
}

export interface LekalaEntry {
  label: string;
  year: number | null;
  date: string | null;
}

type Gen = { code: string; from: number; to: number | null };

/**
 * Бұрын тігілгендерді буын бойынша топтау (CEO, 2026-11-20 — лекала буынға қарай әртүрлі).
 * Буындар белгілі болса — әр буын бөлек топ; белгісіз болса және жыл жазылса — «±1 жыл» / «басқа жылдар»; әйтпесе бір топ.
 */
export function groupLekala(entries: LekalaEntry[], gens: Gen[] | null, year: number | null, limit = 8): LekalaGroup[] {
  const groups = new Map<string, { title: string; order: number; current: boolean; items: LekalaEntry[] }>();
  const put = (id: string, title: string, order: number, current: boolean, e: LekalaEntry) => {
    const g = groups.get(id) ?? { title, order, current, items: [] };
    g.items.push(e);
    groups.set(id, g);
  };
  const curGen = gens && year ? gens.find((x) => year >= x.from && (x.to == null || year <= x.to)) : undefined;
  for (const e of entries) {
    if (gens) {
      // Буын шекарасындағы жыл (мыс. 2019) — жаңа буынға жатқызамыз (кестеде соңғысы бірінші табылады)
      const gen = e.year == null ? undefined : [...gens].reverse().find((x) => e.year! >= x.from && (x.to == null || e.year! <= x.to));
      if (gen) put(gen.code, `${gen.code} · ${gen.from}–${gen.to ?? "қазір"}`, -gen.from, gen === curGen, e);
      else put("none", e.year == null ? "Жылы жазылмаған" : "Басқа жылдар", 9999, false, e);
    } else if (year) {
      const near = e.year != null && Math.abs(e.year - year) <= 1;
      put(near ? "near" : "other", near ? `${year - 1}–${year + 1} жылдар` : e.year == null ? "Жылы жазылмаған / басқа" : "Басқа жылдар", near ? 0 : 1, near, e);
    } else put("all", "Барлық жылдар", 0, false, e);
  }
  // Менеджердің жылына сай буын бұрын тігілмесе де — бос топ болып көрінсін (лекаласы жоқ екені анық болсын)
  if (curGen && !groups.has(curGen.code)) groups.set(curGen.code, { title: `${curGen.code} · ${curGen.from}–${curGen.to ?? "қазір"}`, order: -curGen.from, current: true, items: [] });
  if (year && !gens && !groups.has("near")) groups.set("near", { title: `${year - 1}–${year + 1} жылдар`, order: 0, current: true, items: [] });

  return [...groups.entries()]
    .sort((a, b) => Number(b[1].current) - Number(a[1].current) || a[1].order - b[1].order)
    .map(([id, g]) => {
      const by = new Map<string, { count: number; minYear: number | null; maxYear: number | null; last: string | null }>();
      for (const e of g.items) {
        const p = by.get(e.label) ?? { count: 0, minYear: null, maxYear: null, last: null };
        p.count++;
        if (e.year != null) {
          p.minYear = p.minYear == null ? e.year : Math.min(p.minYear, e.year);
          p.maxYear = p.maxYear == null ? e.year : Math.max(p.maxYear, e.year);
        }
        if (e.date && (!p.last || e.date > p.last)) p.last = e.date;
        by.set(e.label, p);
      }
      const products = [...by.entries()]
        .map(([label, p]) => ({ label, count: p.count, years: yearsText(p), last: p.last }))
        .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label))
        .slice(0, limit);
      const last = g.items.reduce<string | null>((m, e) => (e.date && (!m || e.date > m) ? e.date : m), null);
      // Топ саны — тігілген заказ саны емес, жолдар (тауар + полик) саны; заказ санына жуық болу үшін тек тауар жолдары
      const count = g.items.filter((e) => !e.label.startsWith("+ ")).length;
      return { id, title: g.title, count, last, current: g.current, products };
    });
}
