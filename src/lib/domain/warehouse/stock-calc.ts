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

export type StockStatus = "ok" | "low" | "out" | "none";

/** Күйі: кіріс болмаған (none) · бітті (out) · аз қалды (low, минимумнан төмен) · жеткілікті (ok). */
export function stockStatus(stock: number, min: number | null, everMoved: boolean): StockStatus {
  if (stock <= 0) return everMoved ? "out" : "none";
  if (min != null && stock < min) return "low";
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
