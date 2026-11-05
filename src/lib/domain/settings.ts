import "server-only";
import { prisma } from "@/lib/db";
import { isLeader } from "@/lib/access";
import type { SessionUser } from "@/lib/session";

export type SalesSource = "sheet" | "site";
// 2026-11-05: менеджерлер Google таблицаны толтыра береді, сайт — оның көшірмесі (әдепкі «sheet»).
// Ескі "sales.source" кілті сол күні автоматты «site» болып қалған — сондықтан жаңа кілт.
const KEY = "sales.source.v2";

/**
 * Продажи деректерінің көзі:
 *  - "sheet": менеджерлер Google таблицаны толтырады, сайт оны автоматты тартады (сайттағы кесте — тек оқу)
 *  - "site": менеджерлер сайттағы кестені толтырады, Google таблица синхрондауы тоқтайды
 */
export async function getSalesSource(): Promise<SalesSource> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  return row?.value === "site" ? "site" : "sheet";
}

export async function setSalesSource(actor: SessionUser, value: SalesSource) {
  if (!isLeader(actor)) throw new Error("Тек CEO мен РОП өзгерте алады");
  await prisma.appSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "SETTING", entityType: "AppSetting", entityId: KEY, newValue: { value } } });
}
