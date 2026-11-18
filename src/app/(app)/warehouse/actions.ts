"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { applyMoySklad, createReceipt, previewMoySklad, StockError, updateMaterialStockSettings, type ReceiptInput } from "@/lib/domain/warehouse/stock";
import type { MoySkladRow } from "@/lib/domain/warehouse/stock-calc";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function run(fn: (u: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<{ id?: string } | unknown>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    const r = (await fn(user)) as { id?: string } | undefined;
    revalidatePath("/warehouse", "layout");
    return { ok: true, id: r?.id };
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message };
    if (e instanceof ForbiddenError) return { ok: false, error: "Рұқсат жоқ" };
    console.error("[stock] action", e instanceof Error ? e.message : e);
    return { ok: false, error: "Сақталмады — қайта байқап көріңіз" };
  }
}

export async function createReceiptAction(input: ReceiptInput) {
  return run((u) => createReceipt(u, input));
}

export async function updateMaterialSettingsAction(id: string, patch: { minStock?: number | null; price?: number | null }) {
  return run((u) => updateMaterialStockSettings(u, id, patch));
}

/** МойСклад: алдын ала қарау (базаға ештеңе жазылмайды). */
export async function previewMoySkladAction(rows: MoySkladRow[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    return { ok: true as const, data: await previewMoySklad(user, rows) };
  } catch (e) {
    if (e instanceof StockError) return { ok: false as const, error: e.message };
    if (e instanceof ForbiddenError) return { ok: false as const, error: "Рұқсат жоқ" };
    console.error("[stock] moysklad preview", e instanceof Error ? e.message : e);
    return { ok: false as const, error: "Файлды тексеру мүмкін болмады" };
  }
}

/** МойСклад: қалдықты теңестіру (CEO «Иә, жүктеймін» басқаннан кейін). */
export async function applyMoySkladAction(rows: MoySkladRow[]) {
  return run((u) => applyMoySklad(u, rows));
}
