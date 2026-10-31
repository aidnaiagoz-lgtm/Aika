"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createLead,
  markLeadContacted,
  markLeadLost,
  updateLead,
  reassignLead,
  convertLeadToDeal,
  advanceDealStage,
  advanceDealToOrder,
  markDealPaid,
  markDealLost,
  updateDealAmount,
  reassignDeal,
  requestDiscount,
  decideDiscount,
} from "@/lib/domain/sales";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Сессия аяқталған");
  return user;
}

/** Домендік функция қате лақтырса, Next-тің "developer error" экраны орнына
 *  сол бетке ?error=... арқылы қайта бағыттап, әдемі хабарлама көрсетеді (Order
 *  модулінде қолданылған дәстүрді жалғастырады). */
async function runOrRedirectWithError<T>(fn: () => Promise<T>, redirectPath: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_REDIRECT")) throw e;
    const message = e instanceof Error ? e.message : "Белгісіз қате";
    const sep = redirectPath.includes("?") ? "&" : "?";
    redirect(`${redirectPath}${sep}error=${encodeURIComponent(message)}`);
  }
}

export async function createLeadAction(formData: FormData) {
  const user = await requireUser();
  await runOrRedirectWithError(
    () =>
      createLead(user, {
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        source: String(formData.get("source") ?? "manual"),
      }),
    "/departments/sales/work"
  );
  revalidatePath("/departments/sales/work");
}

export async function markContactedAction(formData: FormData) {
  const user = await requireUser();
  const leadId = String(formData.get("leadId"));
  await runOrRedirectWithError(() => markLeadContacted(user, leadId), "/departments/sales/work");
  revalidatePath("/departments/sales/work");
  revalidatePath(`/departments/sales/leads/${leadId}`);
}

export async function markLeadLostAction(formData: FormData) {
  const user = await requireUser();
  const leadId = String(formData.get("leadId"));
  const reason = String(formData.get("reason") ?? "") || undefined;
  await runOrRedirectWithError(() => markLeadLost(user, leadId, reason), `/departments/sales/leads/${leadId}`);
  revalidatePath("/departments/sales/work");
  revalidatePath(`/departments/sales/leads/${leadId}`);
}

export async function updateLeadAction(formData: FormData) {
  const user = await requireUser();
  const leadId = String(formData.get("leadId"));
  await runOrRedirectWithError(
    () =>
      updateLead(user, leadId, {
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        source: String(formData.get("source") ?? ""),
      }),
    `/departments/sales/leads/${leadId}`
  );
  revalidatePath(`/departments/sales/leads/${leadId}`);
}

export async function reassignLeadAction(formData: FormData) {
  const user = await requireUser();
  const leadId = String(formData.get("leadId"));
  await runOrRedirectWithError(
    () => reassignLead(user, leadId, String(formData.get("assignedToId"))),
    `/departments/sales/leads/${leadId}`
  );
  revalidatePath(`/departments/sales/leads/${leadId}`);
}

export async function convertLeadAction(formData: FormData) {
  const user = await requireUser();
  const leadId = String(formData.get("leadId"));
  await runOrRedirectWithError(async () => {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    return convertLeadToDeal(user, leadId, {
      customerPhone: lead.phone,
      customerFullName: lead.fullName,
      amount: Number(formData.get("amount") ?? 0),
    });
  }, "/departments/sales/work");
  revalidatePath("/departments/sales/work");
}

export async function advanceDealAction(formData: FormData) {
  const user = await requireUser();
  const dealId = String(formData.get("dealId"));
  await runOrRedirectWithError(() => advanceDealStage(user, dealId), "/departments/sales/work");
  revalidatePath("/departments/sales/work");
  revalidatePath(`/departments/sales/deals/${dealId}`);
}

export async function advanceToOrderAction(formData: FormData) {
  const user = await requireUser();
  const dealId = String(formData.get("dealId"));
  const productId = String(formData.get("productId"));
  const qty = Number(formData.get("qty") ?? 1);
  await runOrRedirectWithError(() => advanceDealToOrder(user, dealId, [{ productId, qty }]), "/departments/sales/work");
  revalidatePath("/departments/sales/work");
  revalidatePath(`/departments/sales/deals/${dealId}`);
}

export async function markPaidAction(formData: FormData) {
  const user = await requireUser();
  const dealId = String(formData.get("dealId"));
  await runOrRedirectWithError(() => markDealPaid(user, dealId), "/departments/sales/work");
  revalidatePath("/departments/sales/work");
  revalidatePath(`/departments/sales/deals/${dealId}`);
}

export async function loseDealAction(formData: FormData) {
  const user = await requireUser();
  const dealId = String(formData.get("dealId"));
  const redirectTo = String(formData.get("redirectTo") ?? "/departments/sales/work");
  await runOrRedirectWithError(() => markDealLost(user, dealId), redirectTo);
  revalidatePath("/departments/sales/work");
  revalidatePath(`/departments/sales/deals/${dealId}`);
}

export async function updateDealAmountAction(formData: FormData) {
  const user = await requireUser();
  const dealId = String(formData.get("dealId"));
  await runOrRedirectWithError(
    () => updateDealAmount(user, dealId, Number(formData.get("amount") ?? 0)),
    `/departments/sales/deals/${dealId}`
  );
  revalidatePath(`/departments/sales/deals/${dealId}`);
}

export async function reassignDealAction(formData: FormData) {
  const user = await requireUser();
  const dealId = String(formData.get("dealId"));
  await runOrRedirectWithError(
    () => reassignDeal(user, dealId, String(formData.get("assignedToId"))),
    `/departments/sales/deals/${dealId}`
  );
  revalidatePath(`/departments/sales/deals/${dealId}`);
}

export async function requestDiscountAction(formData: FormData) {
  const user = await requireUser();
  const dealId = String(formData.get("dealId"));
  const redirectTo = String(formData.get("redirectTo") ?? "/departments/sales/work");
  await runOrRedirectWithError(() => requestDiscount(user, dealId, Number(formData.get("requestedPct") ?? 0)), redirectTo);
  revalidatePath("/departments/sales/work");
  revalidatePath(`/departments/sales/deals/${dealId}`);
}

export async function approveDiscountAction(formData: FormData) {
  const user = await requireUser();
  const redirectTo = String(formData.get("redirectTo") ?? "/departments/sales/work");
  await runOrRedirectWithError(() => decideDiscount(user, String(formData.get("discountRequestId")), true), redirectTo);
  revalidatePath("/departments/sales/work");
}

export async function rejectDiscountAction(formData: FormData) {
  const user = await requireUser();
  const redirectTo = String(formData.get("redirectTo") ?? "/departments/sales/work");
  await runOrRedirectWithError(() => decideDiscount(user, String(formData.get("discountRequestId")), false), redirectTo);
  revalidatePath("/departments/sales/work");
}
