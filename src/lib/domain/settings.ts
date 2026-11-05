import "server-only";
import { prisma } from "@/lib/db";
import { isLeader } from "@/lib/access";
import type { SessionUser } from "@/lib/session";

export type SalesSource = "sheet" | "site";
const KEY = "sales.source";

/**
 * Продажи деректерінің көзі:
 *  - "sheet": менеджерлер Google таблицаны толтырады, сайт оны автоматты тартады (сайттағы кесте — тек оқу)
 *  - "site": менеджерлер сайттағы кестені толтырады, Google таблица синхрондауы тоқтайды
 */
export async function getSalesSource(): Promise<SalesSource> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (row) return row.value === "site" ? "site" : "sheet";
  return cutOverToSite();
}

/**
 * Шешім (2026-11-05): менеджерлер сатылымды САЙТТА толтырады. Баптау әлі сақталмаған болса —
 * Google таблицадан соңғы рет тартып аламыз (ештеңе жоғалмасын), сосын «site» деп бекітеміз.
 * CEO қаласа, /import → «Деректер көзі» арқылы таблицаға қайта ауыстыра алады.
 */
let cutover: Promise<SalesSource> | null = null;
function cutOverToSite(): Promise<SalesSource> {
  cutover ??= (async () => {
    try {
      const { syncFromGoogleSheet } = await import("./sales-ledger/sheet-sync");
      await syncFromGoogleSheet({ force: true });
    } catch (e) {
      console.error("Final Google Sheets sync before cut-over failed:", e);
    }
    await prisma.appSetting.upsert({ where: { key: KEY }, update: {}, create: { key: KEY, value: "site" } });
    await prisma.auditLog.create({ data: { action: "SETTING", entityType: "AppSetting", entityId: KEY, newValue: { value: "site", auto: true } } });
    return "site" as const;
  })().finally(() => {
    cutover = null;
  });
  return cutover;
}

export async function setSalesSource(actor: SessionUser, value: SalesSource) {
  if (!isLeader(actor)) throw new Error("Тек CEO мен РОП өзгерте алады");
  await prisma.appSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "SETTING", entityType: "AppSetting", entityId: KEY, newValue: { value } } });
}
