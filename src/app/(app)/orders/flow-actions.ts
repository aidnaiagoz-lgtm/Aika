"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { FlowError, markHanded } from "@/lib/domain/orders/workflow";

export async function markHandedAction(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    await markHanded(user, jobId);
    revalidatePath("/orders/ready");
    revalidatePath("/orders", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof FlowError) return { ok: false, error: e.message };
    console.error("[orders] handed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Сақталмады — қайта байқап көріңіз" };
  }
}
