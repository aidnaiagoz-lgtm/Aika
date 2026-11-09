"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { createLead, updateLead, convertLeadToSale, phoneHistory, runLeadImport, type NewLeadInput, type LeadPatch } from "@/lib/domain/sales-leads";
import { normalizePhone } from "@/lib/domain/sales-ledger/normalize/phone";

type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => {
  console.error("[leads-action]", e instanceof Error ? e.message : e);
  return { ok: false, error: e instanceof Error ? e.message : "Қате" };
};
const PATH = "/departments/sales/almaty/leads";

export async function createLeadAction(input: NewLeadInput & { convert?: boolean }): Promise<R<{ redirect?: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
    const lead = await createLead(user, input);
    revalidatePath(PATH);
    if (input.convert) {
      const r = await convertLeadToSale(user, lead.id);
      revalidatePath("/departments/sales/almaty");
      return { ok: true, data: { redirect: `/departments/sales/almaty?m=${r.month}` } };
    }
    return { ok: true, data: {} };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLeadAction(id: string, patch: LeadPatch): Promise<R> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
    await updateLead(user, id, patch);
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function convertLeadAction(id: string): Promise<R<{ redirect: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
    const r = await convertLeadToSale(user, id);
    revalidatePath(PATH);
    revalidatePath("/departments/sales/almaty");
    revalidatePath("/rating");
    return { ok: true, data: { redirect: `/departments/sales/almaty?m=${r.month}` } };
  } catch (e) {
    return fail(e);
  }
}

/** Ереже 2: телефон терілгенде — нөмірдің тарихы. */
export async function phoneHistoryAction(raw: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const ph = normalizePhone(raw);
  if (!ph.ok) return null;
  return phoneHistory(ph.value);
}

/** CEO / РОП: olx парақтарын импорттау — алдымен dryRun, сосын нақты. */
export async function leadImportAction(dryRun: boolean) {
  try {
    const user = await getCurrentUser();
    if (!user || !isLeader(user)) return { ok: false as const, error: "Тек CEO мен РОП" };
    const r = await runLeadImport({ dryRun });
    if (!dryRun) revalidatePath(PATH);
    return { ok: true as const, data: r };
  } catch (e) {
    return fail(e);
  }
}
