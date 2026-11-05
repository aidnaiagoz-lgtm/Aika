import "server-only";
import { prisma } from "@/lib/db";
import { upsertLedgerRows, reconcileSyncedWindow, type ExcelRow } from "./import";
import { getSalesSource } from "../settings";

// Google Sheets «продажи» → сайт. Таблица "сілтемесі бар адам көре алады" режимінде:
// CSV экспорты (SALES_SHEET_ID, SALES_SHEET_GID=0) тартылады, соңғы WINDOW_DAYS күн жаңартылады.
// Іске қосылу: Рейтинг беті ашылғанда (10 минуттан жиі емес), күнделікті Vercel Cron, CEO батырмасы.

const WINDOW_DAYS = 40;
const MIN_INTERVAL_MS = 10 * 60 * 1000;
const COLS = 45;

export function sheetSyncConfigured() {
  return Boolean(process.env.SALES_SHEET_ID);
}

/** RFC 4180 CSV парсері (тырнақшалар, жол ішіндегі жаңа жол). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function toCell(v: string): string | boolean | null {
  const t = v.trim();
  if (t === "") return null;
  if (t === "TRUE") return true;
  if (t === "FALSE") return false;
  return t;
}

/** "04.11.2026" → "2026-11-04" */
function dayOf(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export async function lastSheetSyncAt(): Promise<Date | null> {
  const last = await prisma.auditLog.findFirst({
    where: { action: "SYNC", entityId: "google-sheets" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt ?? null;
}

export async function syncFromGoogleSheet(): Promise<{ rows: number; removed: number; from: string }> {
  const id = process.env.SALES_SHEET_ID;
  if (!id) throw new Error("SALES_SHEET_ID орнатылмаған");
  if ((await getSalesSource()) === "site") throw new Error("Деректер көзі — «Сайт»: Google таблица синхрондауы өшірулі");
  const gid = process.env.SALES_SHEET_GID ?? "0";
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=${encodeURIComponent(gid)}`, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Google Sheets жауабы ${res.status} — таблица «сілтемесі бар адам көре алады» режимінде ме?`);
  const text = await res.text();
  if (text.trimStart().startsWith("<")) throw new Error("Google CSV орнына бет қайтарды — таблицаның қатынасын тексеріңіз");

  const all = parseCsv(text).slice(1);
  const from = new Date(Date.now() + 5 * 3600_000 - WINDOW_DAYS * 86400_000).toISOString().slice(0, 10);
  const rows: ExcelRow[] = [];
  for (const r of all) {
    const day = dayOf(r[3] ?? "");
    if (!day || day < from || !/^\d+$/.test((r[0] ?? "").trim())) continue;
    rows.push(r.slice(0, COLS).map(toCell));
  }
  if (rows.length === 0) throw new Error("Соңғы күндерде жол табылмады — бағандар реті өзгерген бе?");

  for (let i = 0; i < rows.length; i += 500) await upsertLedgerRows(rows.slice(i, i + 500));
  const { removed } = await reconcileSyncedWindow(from, rows.map((r) => Number(r[0])));
  await prisma.auditLog.create({
    data: { action: "SYNC", entityType: "SalesLedgerRow", entityId: "google-sheets", newValue: { from, rows: rows.length, removed } },
  });
  return { rows: rows.length, removed, from };
}

/**
 * Соңғы синхрондаудан (немесе басталғанынан) 10 минуттан көп өтсе ғана іске қосады.
 * Басталғанда SYNC_START жазылады — қатар ашылған беттер екінші рет іске қоспауы үшін.
 * Қателер жұтылады — бетті бұзбауы үшін.
 */
export async function maybeSyncFromGoogleSheet() {
  if (!sheetSyncConfigured()) return;
  if ((await getSalesSource()) === "site") return;
  const recent = await prisma.auditLog.findFirst({
    where: { action: { in: ["SYNC", "SYNC_START"] }, entityId: "google-sheets", createdAt: { gte: new Date(Date.now() - MIN_INTERVAL_MS) } },
    select: { id: true },
  });
  if (recent) return;
  await prisma.auditLog.create({ data: { action: "SYNC_START", entityType: "SalesLedgerRow", entityId: "google-sheets" } });
  try {
    await syncFromGoogleSheet();
  } catch (e) {
    console.error("Google Sheets sync failed:", e);
  }
}
