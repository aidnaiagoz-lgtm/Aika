/**
 * Сайт → Google кесте: таза бөлік (тесттер осыны тексереді).
 * «продажи» парағында № (A), Год (B), Мес (C), Цена (Y — прайс VLOOKUP), Остаток (AA), Оплаты (AR) — формула,
 * сондықтан оларға жазылмайды. Қалғаны (D..X, Z, AB..AQ, AS) — менеджер толтыратын бағандар.
 */
import { CHECKBOX_FIELDS, isChecked } from "../sheet-layout";

/** 0-ден басталатын баған индекстері (A=0). */
export const FORMULA_COLS = new Set([0, 1, 2, 24, 26, 43]);
/** Қатар жазылатын бөліктер [бастау, соңы] (қоса алғанда). */
export const WRITE_SEGMENTS: [number, number][] = [
  [3, 23],
  [25, 25],
  [27, 42],
  [44, 44],
];

export type Col = { name: string; type: string };
type Cell = string | number | boolean;

const almaty = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString();

/** Сайттағы мәнді кестедегі менеджерлер жазатын түрге келтіру. */
export function toSheetCell(col: Col, v: unknown): Cell {
  if (CHECKBOX_FIELDS.has(col.name)) return isChecked(v);
  if (v === null || v === undefined || v === "") return "";
  if (col.type === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(+d)) return "";
    const s = almaty(d);
    return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`; // 09.11.2026
  }
  if (col.type === "datetime-local") {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(+d)) return "";
    const s = almaty(d);
    return `${s.slice(8, 10)},${s.slice(5, 7)},${s.slice(2, 4)} ${s.slice(11, 13)}-${s.slice(14, 16)}`; // 09,11,26 14-05
  }
  if (col.type === "number") {
    const n = typeof v === "object" && v && "toNumber" in v ? (v as { toNumber(): number }).toNumber() : Number(v);
    return Number.isFinite(n) ? n : "";
  }
  return String(v);
}

/** 45 мән (A..AS); формула бағандары бос қалады — скрипт оларға тимейді. */
export function toSheetValues(columns: Col[], row: Record<string, unknown>): Cell[] {
  return columns.map((c, i) => (FORMULA_COLS.has(i) ? "" : toSheetCell(c, row[c.name])));
}

/**
 * Синхрондау кезінде: кестедегі жол — сайттан жіберілген жолдың көшірмесі ме?
 * № сәйкес және (телефон сәйкес немесе екеуінде де телефон жоқ, бірақ аты сәйкес) болса — иә, қайта импорттамаймыз.
 */
export function isPushedCopy(
  sheet: { no: number; phoneNorm: string | null; customerName: string | null },
  site: { no: number; phoneNorm: string | null; customerName: string | null }
): boolean {
  if (sheet.no !== site.no) return false;
  if (sheet.phoneNorm || site.phoneNorm) return sheet.phoneNorm === site.phoneNorm;
  const n = (s: string | null) => (s ?? "").trim().toLowerCase();
  return n(sheet.customerName) === n(site.customerName);
}

/** Google кестеге қойылатын Apps Script (CEO көшіріп қояды). */
export function appsScript(token: string): string {
  return `// AutoMax: сайттан «продажи» парағына жол жазу. Тек осы токенмен келген сұраныс қабылданады.
const TOKEN = ${JSON.stringify(token)};
const SHEET = "продажи";
// Формула бағандарына тимейміз: A №, B Год, C Мес, Y Цена, AA Остаток, AR Оплаты
const SEGMENTS = ${JSON.stringify(WRITE_SEGMENTS.map(([a, b]) => [a + 1, b + 1]))}; // [бастау, соңы], 1-ден

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.token !== TOKEN) return out({ ok: false, error: "token" });
  if (body.action === "ping") return out({ ok: true, sheet: !!SpreadsheetApp.getActive().getSheetByName(SHEET) });
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let row = Number(body.row) || 0;
    if (!row) {
      // Бірінші бос жол: D (Дата) бағаны бойынша соңғы толтырылған жолдан кейін
      const d = sh.getRange(2, 4, sh.getLastRow() - 1, 1).getValues();
      let i = d.length;
      while (i > 0 && d[i - 1][0] === "") i--;
      row = i + 2;
    }
    const v = body.values;
    SEGMENTS.forEach(function (s) {
      sh.getRange(row, s[0], 1, s[1] - s[0] + 1).setValues([v.slice(s[0] - 1, s[1])]);
    });
    SpreadsheetApp.flush();
    return out({ ok: true, row: row, no: sh.getRange(row, 1).getValue() });
  } finally {
    lock.releaseLock();
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;
}
