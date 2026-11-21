// Қойма: таза функциялар (базасыз) — каталог атауын тану, күйі, неше күнге жетеді.
import type { MaterialCategory } from "@prisma/client";

const KIND: Array<[RegExp, MaterialCategory, string, string]> = [
  // [атаудағы сөз, санат, өлшем бірлігі, қазақша атауы]
  [/^кожа$/i, "LEATHER", "м", "Кожа"],
  [/^(жіп|жип|нитка)$/i, "THREAD", "катушка", "Жіп"],
  [/^лента$/i, "EDGING", "м", "Лента"],
  [/^(ева|eva)$/i, "EVA", "м", "Ева"],
  [/^леска$/i, "FISHING_LINE", "м", "Леска"],
  [/^(поролон|ковролин|карпет)$/i, "CARPET", "м", "Поролон"],
];

export const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  LEATHER: "Кожа",
  THREAD: "Жіп",
  EDGING: "Лента",
  EVA: "Ева",
  FISHING_LINE: "Леска",
  CARPET: "Поролон",
  ACCESSORIES: "Басқа",
};

export interface CatalogItem {
  sku: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  sourceLabel: string;
}

/** «4050 - Кожа - Жанек ромб қара» → каталог жолы. Код болмаса (немесе түрі белгісіз) — null. */
export function parseLedgerMaterial(raw: string | null | undefined): CatalogItem | null {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  const m = s.match(/^(\d{3,6})\s*-\s*([^-]+?)\s*-\s*(.+)$/);
  if (!m) return null;
  const kind = KIND.find(([re]) => re.test(m[2].trim()));
  const rest = m[3].trim();
  if (!rest) return null;
  // Кожадан басқасында атауы тек түс болады («кара») — түрін алдына қосамыз: «Лента кара», «Жіп серый»
  const kindName = kind && kind[1] !== "LEATHER" ? kind[3] : null;
  const name = kindName && !rest.toLowerCase().startsWith(kindName.toLowerCase()) ? `${kindName} ${rest}` : rest;
  return {
    sku: m[1],
    name,
    category: kind ? kind[1] : "ACCESSORIES",
    unit: kind ? kind[2] : "дана",
    sourceLabel: s,
  };
}

export type StockStatus = "ok" | "order" | "urgent" | "low" | "out" | "none";

/** Қытайдан жеткізу ≈ 1,5 ай; оған қоса 15 күн қор → 60 күннен аз қалса заказ беру керек (CEO, 2026-11-21). */
export const LEAD_DAYS = 45;
export const RESERVE_DAYS = 15;
/** Заказ келген соң тағы неше күнге жетсін */
export const COVER_DAYS = 60;

/**
 * Орташа шығын, күніне: соңғы 30 күндегі жұмсалғаны ÷ күн саны. Цех жүйесі жаңа іске қосылса (мыс. 4 күн бұрын) —
 * 30-ға емес, өткен күнге бөлеміз (кемі 3 күн, бір күннің шуы асып кетпесін).
 */
export function perDayUsage(used: number, windowDays: number): number | null {
  if (!(used > 0)) return null;
  return used / Math.max(3, Math.min(30, windowDays));
}

/** Қалдық неше күнге жетеді (шығын белгісіз не қалдық жоқ — null). */
export function daysFor(stock: number, perDay: number | null): number | null {
  if (!perDay || perDay <= 0 || stock <= 0) return null;
  return Math.floor(stock / perDay);
}

export interface Forecast {
  perDay: number | null;
  days: number | null;
  status: StockStatus;
  /** Заказ беру керек мөлшер (бірлікпен) және рулонмен (рулон белгілі болса, жоғары дөңгелектенеді) */
  order: number;
  orderRolls: number | null;
}

/** Қалдық + 30 күндегі шығын → күйі, неше күнге жетеді, қанша заказ беру керек. */
export function forecast(input: {
  stock: number;
  min: number | null;
  everMoved: boolean;
  used: number;
  windowDays: number;
  rollLength: number | null;
  leadDays: number | null;
}): Forecast {
  const lead = input.leadDays != null && input.leadDays > 0 ? input.leadDays : LEAD_DAYS;
  const perDay = perDayUsage(input.used, input.windowDays);
  const days = daysFor(input.stock, perDay);
  const status = stockStatus(input.stock, input.min, input.everMoved, days, lead);
  const order = status === "order" || status === "urgent" || status === "out" ? orderQty(input.stock, perDay ?? 0, lead) : 0;
  const orderRolls = order > 0 && input.rollLength ? Math.ceil(order / input.rollLength) : null;
  return { perDay, days, status, order, orderRolls };
}

/** Қанша заказ беру керек (бірлікпен): жеткізу + келесі кезеңге жететін мөлшер − қазіргі қалдық. */
export function orderQty(stock: number, perDay: number, lead = LEAD_DAYS, cover = COVER_DAYS): number {
  if (!(perDay > 0)) return 0;
  return Math.max(0, perDay * (lead + cover) - Math.max(0, stock));
}

/** Күйі: кіріс болмаған (none) · бітті (out) · аз қалды (low, минимумға жетті не төмен) · жеткілікті (ok). */
export function stockStatus(stock: number, min: number | null, everMoved: boolean, days: number | null = null, lead = LEAD_DAYS): StockStatus {
  if (stock <= 0) return everMoved ? "out" : "none";
  // Жұмсалу қарқынымен: тауар келгенше бітеді → шұғыл; 60 күннен аз → заказ беру керек
  if (days != null && days <= lead) return "urgent";
  if (days != null && days <= lead + RESERVE_DAYS) return "order";
  // Минимумға ТЕҢ болса да «Аз қалды» — тапсырыс беру уақыты келді (CEO, 2026-11-21: 800 м / минимум 800 м «Жеткілікті» деп тұрды)
  if (min != null && min > 0 && stock <= min) return "low";
  return "ok";
}

/** Соңғы 30 күндегі шығынмен қалдық неше күнге жетеді (шығын болмаса — null). */
export function daysLeft(stock: number, out30: number): number | null {
  if (!(out30 > 0) || stock <= 0) return null;
  return Math.max(0, Math.floor(stock / (out30 / 30)));
}

/** «1 240,5» / «1240.5» → 1240.5; бос/қате → null. */
export function parseQty(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const fmtQty = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);

// ---------- Рулон (CEO, 2026-11-21): кожа рулоны ≈ 48–50 м, леска — 45 м ----------

/** Санаттың әдепкі рулон ұзындығы (м). Материалдың өз мәні болса — сол алынады. */
export const DEFAULT_ROLL_LENGTH: Partial<Record<MaterialCategory, number>> = { LEATHER: 50, FISHING_LINE: 45 };

export function rollLengthFor(category: MaterialCategory, own: number | null | undefined): number | null {
  if (own != null && own > 0) return own;
  return DEFAULT_ROLL_LENGTH[category] ?? null;
}

/** Қалдық неше рулон: 0,1-ге дейін дөңгелектенеді. Рулон ұзындығы жоқ не қалдық 0 — null. */
export function rollsOf(stock: number, rollLength: number | null): number | null {
  if (!rollLength || rollLength <= 0 || !(stock > 0)) return null;
  return Math.round((stock / rollLength) * 10) / 10;
}

/** «≈ 16 рулон» / «≈ 0,4 рулон» */
export const fmtRolls = (rolls: number) => `≈ ${fmtQty(rolls)} рулон`;

// ---------- МойСклад «Остатки по товарам» импорты (2026-11-18) ----------

export interface MoySkladRow {
  group: string;
  code: string;
  name: string;
  unit: string;
  stock: number;
  cost: number;
}

/** МойСкладтағы цех топтары → сайттағы санат. Цехқа қатысы жоқ топтар (чехол, накидка…) алынбайды. */
export function moySkladCategory(group: string, unit?: string): MaterialCategory | null {
  const g = group.toLowerCase();
  if (!g.startsWith("цех/")) return null;
  // «Кожы» тобында дана-мен саналатын заттар да бар (аптечка, жилет…) — олар кожа емес
  if (g.includes("кож")) return unit == null || /^(м|рулон|)$/i.test(unit.trim()) ? "LEATHER" : "ACCESSORIES";
  if (g.includes("жіп") || g.includes("нитк")) return "THREAD";
  if (g.includes("лента")) return "EDGING";
  if (g.includes("ева") || g.includes("eva")) return "EVA";
  if (g.includes("леска") || g.includes("ворс")) return "FISHING_LINE";
  return "ACCESSORIES";
}

const num = (v: unknown) => {
  if (typeof v === "number") return v;
  const n = parseQty(typeof v === "string" ? v : null);
  return n ?? 0;
};

/**
 * Excel кестесінен (жолдар массиві) МойСклад жолдарын алады: «Код / Наименование / Ед.изм. / Остаток / Себестоимость»
 * тақырыбын өзі табады; тек атауы бар жол — топ («Цех/Материалы / Кожы»). Тек цех топтары қайтарылады.
 */
export function parseMoySkladMatrix(matrix: unknown[][]): MoySkladRow[] {
  const s = (v: unknown) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
  const hi = matrix.findIndex((r) => r.some((c) => s(c) === "Код") && r.some((c) => s(c) === "Наименование") && r.some((c) => s(c) === "Остаток"));
  if (hi < 0) throw new Error("Бұл МойСкладтың «Остатки по товарам» есебі емес сияқты — «Код», «Наименование», «Остаток» бағандары табылмады");
  const h = matrix[hi].map(s);
  const col = (name: string) => h.findIndex((x) => x.toLowerCase().startsWith(name.toLowerCase()));
  const [cCode, cName, cUnit, cStock, cCost] = [col("Код"), col("Наименование"), col("Ед"), col("Остаток"), col("Себестоимость")];
  const out: MoySkladRow[] = [];
  let group = "";
  for (const r of matrix.slice(hi + 1)) {
    const code = typeof r[cCode] === "number" ? String(Math.round(r[cCode] as number)) : s(r[cCode]);
    const name = s(r[cName]);
    if (code && !name && !s(r[cUnit])) {
      group = code;
      continue;
    }
    if (!name || !code || !moySkladCategory(group)) continue;
    out.push({ group, code, name, unit: s(r[cUnit]) || "дана", stock: num(r[cStock]), cost: cCost >= 0 ? num(r[cCost]) : 0 });
  }
  return out;
}
