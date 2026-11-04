"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ensureManagers, blockDemoManager, ManagerError } from "@/lib/domain/managers";
import { importLedgerChunk, logImport, type ExcelRow } from "@/lib/domain/sales-ledger/import";
import { syncFromGoogleSheet } from "@/lib/domain/sales-ledger/sheet-sync";
import { isLeader } from "@/lib/access";
import { redirect } from "next/navigation";

export async function ensureManagersAction(names: string[], blockDemo: boolean) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Сессия аяқталған" };
  try {
    const res = await ensureManagers(user, names);
    const demoBlocked = blockDemo ? await blockDemoManager(user) : false;
    return { ok: true as const, ...res, demoBlocked };
  } catch (e) {
    return { ok: false as const, error: e instanceof ManagerError || e instanceof Error ? e.message : "Қате" };
  }
}

export async function importChunkAction(rows: ExcelRow[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Сессия аяқталған" };
  try {
    return { ok: true as const, ...(await importLedgerChunk(user, rows)) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Импорт қатесі" };
  }
}

export async function finishImportAction(summary: { rows: number; from: string; to: string; managers: string[] }) {
  const user = await getCurrentUser();
  if (!user) return;
  await logImport(user, summary);
  revalidatePath("/rating");
  revalidatePath("/departments/sales/almaty");
}

export async function syncSheetNowAction() {
  const user = await getCurrentUser();
  if (!user || !isLeader(user)) return;
  let msg: string;
  try {
    const r = await syncFromGoogleSheet();
    msg = `ok:${r.rows}:${r.removed}`;
  } catch (e) {
    msg = "err:" + (e instanceof Error ? e.message : "қате");
  }
  revalidatePath("/rating");
  revalidatePath("/departments/sales/almaty");
  redirect(`/import?sync=${encodeURIComponent(msg)}#sheet-sync`);
}
