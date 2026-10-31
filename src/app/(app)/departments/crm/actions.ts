"use server";

import { revalidatePath } from "next/cache";
import type { CustomerSegment } from "@/lib/db";
import {
  updateCustomerSegment,
  setCustomerVip,
  setCustomerInactive,
  setCustomerNps,
  addCustomerContact,
  addCustomerCar,
} from "@/lib/domain/crm";
import { getCurrentUser } from "@/lib/auth";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Сессия аяқталған");
  return user;
}

export async function setSegmentAction(formData: FormData) {
  const user = await requireUser();
  const customerId = String(formData.get("customerId"));
  await updateCustomerSegment(user, customerId, formData.get("segment") as CustomerSegment);
  revalidatePath(`/departments/crm/customers/${customerId}`);
}

export async function toggleVipAction(formData: FormData) {
  const user = await requireUser();
  const customerId = String(formData.get("customerId"));
  const nextVip = formData.get("nextVip") === "true";
  await setCustomerVip(user, customerId, nextVip);
  revalidatePath(`/departments/crm/customers/${customerId}`);
}

export async function toggleInactiveAction(formData: FormData) {
  const user = await requireUser();
  const customerId = String(formData.get("customerId"));
  const nextInactive = formData.get("nextInactive") === "true";
  await setCustomerInactive(user, customerId, nextInactive);
  revalidatePath(`/departments/crm/customers/${customerId}`);
  revalidatePath("/departments/crm/work");
}

export async function setNpsAction(formData: FormData) {
  const user = await requireUser();
  const customerId = String(formData.get("customerId"));
  const nps = Number(formData.get("npsScore") ?? 0);
  await setCustomerNps(user, customerId, nps);
  revalidatePath(`/departments/crm/customers/${customerId}`);
  revalidatePath("/departments/crm/work");
}

export async function addContactAction(formData: FormData) {
  const user = await requireUser();
  const customerId = String(formData.get("customerId"));
  await addCustomerContact(user, customerId, {
    channel: String(formData.get("channel") ?? ""),
    value: String(formData.get("value") ?? ""),
  });
  revalidatePath(`/departments/crm/customers/${customerId}`);
}

export async function addCarAction(formData: FormData) {
  const user = await requireUser();
  const customerId = String(formData.get("customerId"));
  const yearRaw = formData.get("year");
  await addCustomerCar(user, customerId, {
    make: String(formData.get("make") ?? ""),
    model: String(formData.get("model") ?? ""),
    year: yearRaw ? Number(yearRaw) : undefined,
  });
  revalidatePath(`/departments/crm/customers/${customerId}`);
}
