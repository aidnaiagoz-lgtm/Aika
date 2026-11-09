/**
 * Кестедегі күн/уақыт мәтінін оқу. Менеджерлер 120-дан астам түрлі форматта жазған:
 *   "04,11,26 13-18", "31.10.26 12-43", "04.11.2026", "04,11,2613-18" (бос орынсыз),
 *   "04,1126 13-18", "04,11,,26 13-18", "04/11/26 13:18", Excel сериялық саны "46327" т.б.
 * Уақыт Алматы бойынша (UTC+5) жазылған деп есептеледі → UTC-ге аударылады.
 * Тек күн болса — UTC түн ортасы (жүйедегі күн белгісі, sales-ledger/import.ts-пен бірдей).
 */
export type DateResult = { ok: true; value: Date; hasTime: boolean } | { ok: false; reason: "empty" | "format" | "range" };

const ALMATY_OFFSET_H = 5;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function parseSheetDate(raw: unknown): DateResult {
  if (raw === null || raw === undefined) return { ok: false, reason: "empty" };
  if (raw instanceof Date) return Number.isNaN(+raw) ? { ok: false, reason: "format" } : { ok: true, value: raw, hasTime: true };
  if (typeof raw === "number") return fromSerial(raw);
  const s = String(raw).trim().replace(/\s+/g, " ");
  if (!s) return { ok: false, reason: "empty" };

  // Excel сериялық саны мәтін түрінде ("46327" немесе "46327,5")
  if (/^\d{5}([.,]\d+)?$/.test(s)) return fromSerial(Number(s.replace(",", ".")));

  // ISO: 2026-11-04 / 2026-11-04 14:30 / 2026-11-04T14:30:00Z
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (iso) {
    if (iso[7]) return check(new Date(s), true);
    return build(+iso[1], +iso[2], +iso[3], iso[4] ? +iso[4] : null, iso[5] ? +iso[5] : null);
  }

  // Қалғаны: бөлгіштер әртүрлі (. , / ; - бос орын, екі рет қатар) — сандарды топтап аламыз.
  // Тек цифр, бөлгіш және ең көбі соңғы «\» сияқты қоқыс таңба болуы керек.
  if (!/^[\d.,/;:\- \\]+$/.test(s)) return { ok: false, reason: "format" };
  const g = s.split(/[^\d]+/).filter(Boolean);
  // күн, ай, жыл [, сағат, минут]
  if ((g.length === 3 || g.length === 5) && g[0].length <= 2 && g[1].length <= 2 && (g[2].length === 2 || g[2].length === 4)) {
    if (g.length === 3 && g[2].length === 4 && !g[2].startsWith("20")) return { ok: false, reason: "format" };
    return build(year(g[2]), +g[1], +g[0], g.length === 5 ? +g[3] : null, g.length === 5 ? +g[4].slice(0, 2) : null);
  }
  if (g.length === 4 && g[0].length <= 2) {
    // "04,11,2613-18": жыл мен сағат жабысқан (yyhh)
    if (g[1].length <= 2 && g[2].length === 4 && !g[2].startsWith("20"))
      return build(year(g[2].slice(0, 2)), +g[1], +g[0], +g[2].slice(2), +g[3].slice(0, 2));
    // "04,1126 13-18": ай мен жыл жабысқан (mmyy)
    if (g[1].length === 4) return build(year(g[1].slice(2)), +g[1].slice(0, 2), +g[0], +g[2], +g[3].slice(0, 2));
  }
  // "04,1126" — тек күн, ай+жыл жабысқан
  if (g.length === 2 && g[0].length <= 2 && g[1].length === 4) return build(year(g[1].slice(2)), +g[1].slice(0, 2), +g[0], null, null);
  // "04,11,26 13 18 7" сияқты артық топ — уақыттан кейінгі қоқыс
  if (g.length === 6 && g[0].length <= 2 && g[1].length <= 2 && g[2].length === 2)
    return build(year(g[2]), +g[1], +g[0], +g[3], +g[4].slice(0, 2));

  return { ok: false, reason: "format" };
}

function year(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y);
}

function build(y: number, mo: number, d: number, h: number | null, mi: number | null): DateResult {
  if (y < 2020 || y > 2035 || mo < 1 || mo > 12 || d < 1 || d > 31) return { ok: false, reason: "range" };
  if (h !== null && (h > 23 || mi === null || mi > 59)) return { ok: false, reason: "range" };
  const value = h === null ? new Date(Date.UTC(y, mo - 1, d)) : new Date(Date.UTC(y, mo - 1, d, h - ALMATY_OFFSET_H, mi ?? 0));
  // 31.02 сияқты жоқ күндер — Date оны келесі айға аударып жібереді
  if (new Date(Date.UTC(y, mo - 1, d)).getUTCDate() !== d) return { ok: false, reason: "range" };
  return { ok: true, value, hasTime: h !== null };
}

function fromSerial(n: number): DateResult {
  if (!Number.isFinite(n) || n < 43831 || n > 49000) return { ok: false, reason: "range" }; // 2020-01-01 … 2034
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac === 0) return { ok: true, value: new Date(EXCEL_EPOCH + whole * 86400_000), hasTime: false };
  // Бөлшек бөлігі — Алматы уақыты
  const ms = EXCEL_EPOCH + whole * 86400_000 + Math.round(frac * 86400) * 1000 - ALMATY_OFFSET_H * 3600_000;
  return { ok: true, value: new Date(ms), hasTime: true };
}

function check(d: Date, hasTime: boolean): DateResult {
  return Number.isNaN(+d) ? { ok: false, reason: "format" } : { ok: true, value: d, hasTime };
}

/** Есепке: "04,11,26 13-18" → "99,99,99 99-99" (мәннің өзін емес, пішінін көрсету үшін). */
export const dateShape = (raw: unknown) => String(raw ?? "").trim().replace(/\d/g, "9");
