import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import { isLeader } from "@/lib/access";
import { withLedgerLock } from "./lock";
import { sheetPushConfig } from "./sheet-push";

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

/**
 * Сайтта жазылып, Google кестеге ТҮСПЕЙ тұрған жолдар (скрипт қате береді). 2026-11-21: CEO-ның 3 заказы кестеге
 * жіберілмей, бірақ сайтта саналып тұрды — айналым екі жақта әртүрлі. Себебін (скрипт қатесін) CEO-ға көрсетеміз.
 */
export async function unpushedSummary() {
  const cfg = await sheetPushConfig();
  type U = { id: string; no: number; day: string | null; manager: string | null; car: string; product: string | null; sum: number };
  if (!cfg.enabled || !cfg.since) return { count: 0, sum: 0, nos: [] as number[], managers: [] as string[], error: null as string | null, rows: [] as U[] };
  const rows = await prisma.salesLedgerRow.findMany({
    where: {
      importKey: null,
      sheetPushedAt: null,
      createdAt: { gte: cfg.since, lt: new Date(Date.now() - 10 * 60_000) },
      sheetPushError: { not: null },
    },
    select: { id: true, no: true, date: true, car: true, brand: true, product: true, soldFor: true, manager: true, sheetPushError: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const real = rows.filter((r) => r.sheetPushError !== "pending");
  return {
    count: real.length,
    sum: real.reduce((s, r) => s + Number(r.soldFor ?? 0), 0),
    nos: real.map((r) => r.no).sort((a, b) => a - b),
    managers: [...new Set(real.map((r) => r.manager).filter((m): m is string => !!m))],
    error: real.find((r) => r.sheetPushError && !/timeout|aborted|үзілді/i.test(r.sheetPushError))?.sheetPushError ?? real[0]?.sheetPushError ?? null,
    // Клиент аты/телефоны жоқ — тек заказды тану үшін көлік, тауар, сома
    rows: real
      .map((r) => ({
        id: r.id,
        no: r.no,
        day: r.date?.toISOString().slice(0, 10) ?? null,
        manager: r.manager,
        car: [r.car, r.brand].filter(Boolean).join(" "),
        product: r.product,
        sum: Number(r.soldFor ?? 0),
      }))
      .sort((a, b) => a.no - b.no) as U[],
  };
}

/** CEO/РОП: Google-ға түспеген сайт жолын өшіру (мыс. тест заказ). Тек кестеге ешқашан түспеген жол өшеді. */
export async function removeUnpushedRow(user: SessionUser, id: string) {
  if (!isLeader(user)) throw new Error("Тек CEO немесе РОП өшіре алады");
  return withLedgerLock(async () => {
    const row = await prisma.salesLedgerRow.findUnique({ where: { id }, select: { id: true, no: true, importKey: true, sheetPushedAt: true } });
    if (!row) throw new Error("Жол табылмады");
    if (row.importKey || row.sheetPushedAt) throw new Error("Бұл жол Google кестеде бар — оны кестеде өзгертіңіз");
    await prisma.workshopJob.updateMany({ where: { ledgerRowId: id, status: { in: ["NEW", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    await prisma.salesLedgerRow.delete({ where: { id } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "DELETE", entityType: "SalesLedgerRow", entityId: id, newValue: { no: row.no, reason: "unpushed" } as object } });
    return { no: row.no };
  });
}
