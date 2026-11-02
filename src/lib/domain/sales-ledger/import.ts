import "server-only";
import { prisma } from "@/lib/db";
import { isLeader } from "@/lib/access";
import type { SessionUser } from "@/lib/session";
import { LEDGER_COLUMNS } from "./fields";

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
    // Excel-дегі қолмен жазылған "25,09,25 16-46" форматы
    const m = v.trim().match(/^(\d{1,2})[.,](\d{1,2})[.,](\d{2,4})(?:\s+(\d{1,2})[-:.](\d{2}))?/);
    if (m) {
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0) - 5, Number(m[5] ?? 0)));
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
      data[col.name] = toDate(v);
    } else {
      data[col.name] = toText(v);
    }
  });
  // Excel-де "Остаток" бағаны мәтін болуы мүмкін: "Төленді" → 0, "Возврат" → 0 + статус.
  const rawRemainder = row[26];
  if (typeof rawRemainder === "string") {
    data.remainder = 0;
    if (/возврат/i.test(rawRemainder) && !data.orderStatus) data.orderStatus = "возврат";
  }
  if (typeof data.no !== "number" || !data.date) return null;
  return data;
}

export async function importLedgerChunk(actor: SessionUser, rows: ExcelRow[]) {
  if (!isLeader(actor)) throw new Error("Импортты тек CEO мен РОП жасай алады");
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
      branchId: branch.id,
      importKey: `excel:${d.no}`,
      createdById: typeof d.manager === "string" ? byName.get(d.manager.trim().toLocaleLowerCase("ru")) ?? null : null,
    }));

  // Қайта импорт: Excel — шындық көзі; бұрын импортталған сол жолдарды жаңасымен ауыстырамыз.
  const keys = prepared.map((d) => d.importKey);
  await prisma.$transaction([
    prisma.salesLedgerRow.deleteMany({ where: { importKey: { in: keys } } }),
    prisma.salesLedgerRow.createMany({ data: prepared as never }),
  ]);
  return { imported: prepared.length, skipped: rows.length - prepared.length };
}

export async function logImport(actor: SessionUser, summary: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "IMPORT", entityType: "SalesLedgerRow", entityId: "excel", newValue: summary as object },
  });
}
