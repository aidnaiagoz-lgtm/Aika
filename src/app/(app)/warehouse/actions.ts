"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { createReceipt, StockError, updateMaterialStockSettings, type ReceiptInput } from "@/lib/domain/warehouse/stock";

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
