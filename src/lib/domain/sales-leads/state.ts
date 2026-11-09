import "server-only";
import { prisma } from "@/lib/db";

// Лидтер жүйесі нақты импорт жасалғаннан кейін ғана «қосулы» болады (ереже 1 мен olx синхрондауы).
// Әйтпесе olx парақтары импортталмай тұрып ереже 1 авто-лидтер жасап, кейін дубль шығар еді.
const KEY = "sales.leads.active";

export async function leadsActive(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  return row?.value === "1";
}

export async function activateLeads() {
  await prisma.appSetting.upsert({ where: { key: KEY }, update: { value: "1" }, create: { key: KEY, value: "1" } });
}
