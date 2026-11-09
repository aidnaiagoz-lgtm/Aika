import "server-only";
import { prisma } from "@/lib/db";
import { isLeader } from "@/lib/access";
import type { SessionUser } from "@/lib/session";
import { LEDGER_COLUMNS } from "./fields";
import { parseSheetDate } from "./normalize/dates";
import { normalizePhone } from "./normalize/phone";
import { matchChannel } from "./normalize/dictionaries";

// Excel "продажи" парағы → SalesLedgerRow. Бағандар реті LEDGER_COLUMNS-пен бірдей (A..AS, 45 баған).
// Браузер файлды өзі оқып, жолдарды бөліктеп жібереді (Vercel 4.5 MB шегі), әр жол — 45 мәнді массив;
// Date мәндері ISO жол ретінде келеді.

export type ExcelCell = string | number | boolean | null;
export type ExcelRow = ExcelCell[];

const INT_FIELDS = new Set(["no", "year", "carYear", "pocketsPairs"]);
const DECIMAL_FIELDS = new Set(["price", "soldFor", "remainder", "managerBonus", "receipt1Amount", "receipt2Amount", "receipt3Amount"]);
const DATE_FIELDS = new Set(["date", "readyOrderDate", "receipt1At", "receipt2At", "receipt3At"]);

function toNumber(v: ExcelCell): number | null {
  if (v === null || v === "" || typeof v === "boolean") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: ExcelCell): Date | null {
  if (v === null || v === "" || typeof v === "boolean") return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(+d) ? null : d;
  }
  if (typeof v === "string") {
    // Google Sheets синхрондауы: "2026-11-04" (күн) немесе "2026-11-04 14:30" (Алматы уақыты)
    const iso = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (iso) {
      const [, y, mo, d, h, mi, se] = iso;
      const date = h
        ? new Date(Date.UTC(+y, +mo - 1, +d, +h - 5, +mi, +(se ?? 0)))
        : new Date(Date.UTC(+y, +mo - 1, +d));
      return Number.isNaN(+date) ? null : date;
    }
    // Excel-дегі қолмен жазылған "25,09,25 16-46" форматы
    const m = v.trim().match(/^(\d{1,2})[.,](\d{1,2})[.,](\d{2,4})(?:\s+(\d{1,2})[-:.](\d{2}))?/);
    if (m) {
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      // Тек күн ("04.11.2026") → UTC түн ортасы (жүйедегі күн белгісі); уақыты бар болса — Алматы → UTC
      const d = m[4]
        ? new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1]), Number(m[4]) - 5, Number(m[5] ?? 0)))
        : new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])));
      return Number.isNaN(+d) ? null : d;
    }
  }
  return null;
}

function toText(v: ExcelCell): string | null {
  if (v === null) return null;
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : String(v);
  return s.trim() === "" ? null : s.trim();
}

/** Бір Excel жолын Prisma деректеріне айналдырады. № жоқ болса — null (өткізіледі). */
function mapRow(row: ExcelRow): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  LEDGER_COLUMNS.forEach((col, i) => {
    const v = row[i] ?? null;
    if (INT_FIELDS.has(col.name)) {
      const n = toNumber(v);
      data[col.name] = n !== null && Number.isInteger(n) ? n : n !== null ? Math.round(n) : null;
    } else if (DECIMAL_FIELDS.has(col.name)) {
      data[col.name] = toNumber(v);
    } else if (DATE_FIELDS.has(col.name)) {
      // Кестедегі 120+ форматты оқиды (Excel сериялық саны да); оқылмаса — бұрынғы оқушы
      const d = typeof v === "boolean" ? null : parseSheetDate(v);
      data[col.name] = d && d.ok ? d.value : toDate(v);
    } else {
      data[col.name] = toText(v);
    }
  });
  // Excel-де "Остаток" бағаны мәтін болуы мүмкін: "Төленді" → 0, "Возврат" → 0 + статус.
  const rawRemainder = row[26];
  // Мәтін (сан емес) болса ғана: CSV-де сандар да мәтін түрінде келеді ("22 500")
  if (typeof rawRemainder === "string" && rawRemainder.trim() !== "" && toNumber(rawRemainder) === null) {
    data.remainder = 0;
    if (/возврат/i.test(rawRemainder) && !data.orderStatus) data.orderStatus = "возврат";
  }
  if (typeof data.no !== "number" || !data.date) return null;
  return data;
}

/** Сайттағы жолдың нормаланған мәндері: телефон (10 цифр) және канал коды. */
export function normalizedFields(row: { customerPhone?: unknown; contactChannel?: unknown }) {
  const ph = normalizePhone(row.customerPhone);
  const ch = matchChannel(row.contactChannel);
  return { phoneNorm: ph.ok ? ph.value : null, channelCode: ch && ch.code ? ch.code : null };
}

const same = (a: unknown, b: unknown): boolean => {
  const n = (v: unknown) =>
    v === undefined || v === null ? null : v instanceof Date ? v.getTime() : typeof v === "object" && "toNumber" in (v as object) ? (v as { toNumber(): number }).toNumber() : v;
  return n(a) === n(b);
};

/**
 * Жолдарды Продажи кестесіне жазады (importKey = "excel:<№>").
 * 2026-11 (Кезең 1): жол ӨШІРІЛІП-ҚАЙТА ЖАСАЛМАЙДЫ — бар болса орнында жаңартылады (id тұрақты,
 * Лид/Касса байланыстары үзілмейді). Тек өзгерген жолдар жазылады. Excel импорты мен Google синхрондауы осыны қолданады.
 * Қайтарады: жаңа/өзгерген жолдардың id-лері (ереже 1 — ОЛХ лидін байланыстыру — соларға ғана іске қосылады).
 */
export async function upsertLedgerRows(rows: ExcelRow[]) {
  if (rows.length > 1000) throw new Error("Бір бөлікте 1000 жолдан аспауы керек");

  const branch = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } } });
  if (!branch) throw new Error("Алматы филиалы табылмады");

  const employees = await prisma.employee.findMany({ select: { id: true, fullName: true } });
  const byName = new Map(employees.map((e) => [e.fullName.trim().toLocaleLowerCase("ru"), e.id]));

  const prepared = rows
    .map(mapRow)
    .filter((d): d is Record<string, unknown> => d !== null)
    .map((d) => ({
      ...d,
      ...normalizedFields(d),
      branchId: branch.id,
      importKey: `excel:${d.no}`,
      createdById: typeof d.manager === "string" ? byName.get(d.manager.trim().toLocaleLowerCase("ru")) ?? null : null,
    }));

  const keys = prepared.map((d) => d.importKey);
  const existing = await prisma.salesLedgerRow.findMany({ where: { importKey: { in: keys } } });
  const byKey = new Map<string, (typeof existing)[number]>();
  for (const e of existing) if (e.importKey && !byKey.has(e.importKey)) byKey.set(e.importKey, e);

  const toCreate: Record<string, unknown>[] = [];
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  for (const d of prepared) {
    const cur = byKey.get(d.importKey) as Record<string, unknown> | undefined;
    if (!cur) {
      toCreate.push(d);
      continue;
    }
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) if (!same(cur[k], v)) changed[k] = v;
    if (Object.keys(changed).length) updates.push({ id: cur.id as string, data: changed });
  }

  if (toCreate.length) await prisma.salesLedgerRow.createMany({ data: toCreate as never });
  for (let i = 0; i < updates.length; i += 100) {
    await prisma.$transaction(updates.slice(i, i + 100).map((u) => prisma.salesLedgerRow.update({ where: { id: u.id }, data: u.data as never })));
  }
  const createdIds = toCreate.length
    ? (await prisma.salesLedgerRow.findMany({ where: { importKey: { in: toCreate.map((d) => d.importKey as string) } }, select: { id: true } })).map((r) => r.id)
    : [];
  return {
    imported: prepared.length,
    created: toCreate.length,
    updated: updates.length,
    skipped: rows.length - prepared.length,
    changedIds: [...createdIds, ...updates.map((u) => u.id)],
  };
}

export async function importLedgerChunk(actor: SessionUser, rows: ExcelRow[]) {
  if (!isLeader(actor)) throw new Error("Импортты тек CEO мен РОП жасай алады");
  return upsertLedgerRows(rows);
}

/**
 * Синхрондау терезесінде (from күнінен бастап) таблицадан өшірілген жолдарды сайттан да алып тастайды.
 * Тек импортталған (importKey бар) жолдарға тиеді — сайтта қолмен енгізілгендер қалады.
 */
export async function reconcileSyncedWindow(fromDay: string, nos: number[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay)) throw new Error("from форматы қате");
  const keep = new Set(nos.map((n) => `excel:${n}`));
  const existing = await prisma.salesLedgerRow.findMany({
    where: { importKey: { startsWith: "excel:" }, date: { gte: new Date(fromDay + "T00:00:00Z") } },
    select: { id: true, importKey: true },
  });
  const stale = existing.filter((r) => r.importKey && !keep.has(r.importKey)).map((r) => r.id);
  if (stale.length) await prisma.salesLedgerRow.deleteMany({ where: { id: { in: stale } } });
  // Сайтта ашылып, 30 минуттан бері бос тұрған жолдар (тек Дата/Менеджер) — қоқыс
  const shells = await prisma.salesLedgerRow.deleteMany({
    where: {
      importKey: null,
      updatedAt: { lt: new Date(Date.now() - 30 * 60_000) },
      date: { gte: new Date(fromDay + "T00:00:00Z") },
      customerPhone: null,
      customerName: null,
      product: null,
      price: null,
      soldFor: null,
      orderStatus: null,
    },
  });
  await renumberSiteRows(nos);
  return { removed: stale.length + shells.count };
}

/**
 * Сайтта жазылған жолдың № таблицадағы жаңа жолдың №-імен сәйкес келсе (екі жақта бір уақытта толтырғанда),
 * таблицаныкі өз нөмірінде қалады, сайттағы жол ең соңғы бос нөмірге ауысады — № қайталанбайды.
 */
async function renumberSiteRows(sheetNos: number[]) {
  if (sheetNos.length === 0) return;
  const clash = await prisma.salesLedgerRow.findMany({
    where: { importKey: null, no: { in: sheetNos } },
    orderBy: { createdAt: "asc" },
    select: { id: true, branchId: true },
  });
  for (const row of clash) {
    const max = await prisma.salesLedgerRow.aggregate({ where: { branchId: row.branchId }, _max: { no: true } });
    await prisma.salesLedgerRow.update({ where: { id: row.id }, data: { no: (max._max.no ?? 0) + 1 } });
  }
}

export async function logImport(actor: SessionUser, summary: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "IMPORT", entityType: "SalesLedgerRow", entityId: "excel", newValue: summary as object },
  });
}
