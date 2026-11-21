import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import { isLeader } from "@/lib/access";
import { withLedgerLock } from "./lock";

/**
 * Google-дан өшірілген, бірақ сайтта қалған жолдар (CEO, 2026-11-21).
 * Себебі: сайтта жазылған жол (заказ формасы / сайттағы Продажи) Google кестеге жіберіледі; кестеде оны өшірсе —
 * сайттағысы өздігінен өшпейді (сайт жолы — түпнұсқа), сондықтан айналым мен рейтингте артық саналады.
 * Синхрондау әр жолы тексереді, ал өшіруді тек CEO/РОП басады (деректі өзі өшірмейміз).
 */

const KEY = "sales.sheetOrphans";
/** Жаңа ғана жіберілген жол кестенің CSV-інде әлі көрінбеуі мүмкін — 15 минуттан ескілерін ғана тексереміз */
const GRACE_MS = 15 * 60_000;

/**
 * Синхрондаудан кейін: кестеге жіберілген сайт жолдары (терезе ішінде), олардың №-і кестеде толтырылған жол ретінде
 * жоқ болса — «жетім». Тізімі AppSetting-ке сақталады (баннер мен «Өшіру» соны оқиды).
 */
export async function detectSheetOrphans(fromDay: string, filledNos: number[]) {
  const filled = new Set(filledNos);
  const rows = await prisma.salesLedgerRow.findMany({
    where: {
      importKey: null,
      sheetPushedAt: { not: null, lt: new Date(Date.now() - GRACE_MS) },
      date: { gte: new Date(fromDay + "T00:00:00Z") },
    },
    select: { id: true, no: true },
  });
  const ids = rows.filter((r) => !filled.has(r.no)).map((r) => r.id);
  await prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify({ ids, at: new Date().toISOString() }) },
    create: { key: KEY, value: JSON.stringify({ ids, at: new Date().toISOString() }) },
  });
  return ids.length;
}

async function storedIds(): Promise<string[]> {
  const s = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!s) return [];
  try {
    const v = JSON.parse(s.value) as { ids?: unknown };
    return Array.isArray(v.ids) ? v.ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function orphanRows() {
  const ids = await storedIds();
  if (!ids.length) return [];
  // Арада кестеге қайта түссе / импортталса — енді жетім емес
  return prisma.salesLedgerRow.findMany({
    where: { id: { in: ids }, importKey: null, sheetPushedAt: { not: null } },
    select: { id: true, no: true, soldFor: true, manager: true, date: true },
    orderBy: { no: "asc" },
  });
}

/** Баннер үшін: саны, сомасы, №-лері, кім енгізген (клиент аты/телефоны жоқ). */
export async function sheetOrphanSummary() {
  const rows = await orphanRows();
  return {
    count: rows.length,
    sum: rows.reduce((s, r) => s + Number(r.soldFor ?? 0), 0),
    nos: rows.map((r) => r.no),
    managers: [...new Set(rows.map((r) => r.manager).filter((m): m is string => !!m))],
    days: [...new Set(rows.map((r) => r.date?.toISOString().slice(0, 10)).filter((d): d is string => !!d))],
  };
}

/** CEO/РОП: Google-дан өшірілген сайт жолдарын сайттан да өшіру. Цехтағы әлі бітпеген тапсырмасы «Алынды» болады. */
export async function removeSheetOrphans(user: SessionUser) {
  if (!isLeader(user)) throw new Error("Тек CEO немесе РОП өшіре алады");
  return withLedgerLock(async () => {
    const rows = await orphanRows();
    if (!rows.length) return { removed: 0 };
    const ids = rows.map((r) => r.id);
    await prisma.workshopJob.updateMany({ where: { ledgerRowId: { in: ids }, status: { in: ["NEW", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    const del = await prisma.salesLedgerRow.deleteMany({ where: { id: { in: ids }, importKey: null } });
    await prisma.appSetting.update({ where: { key: KEY }, data: { value: JSON.stringify({ ids: [], at: new Date().toISOString() }) } });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "DELETE", entityType: "SalesLedgerRow", entityId: "sheet-orphans", newValue: { nos: rows.map((r) => r.no) } as object },
    });
    return { removed: del.count };
  });
}
