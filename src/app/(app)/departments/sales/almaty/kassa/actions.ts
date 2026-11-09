"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { act, closeDay, importKassaSheet, setSenior, setOpenFrom } from "@/lib/domain/sales-kassa";

const PATH = "/departments/sales/almaty/kassa";
const fail = (e: unknown) => {
  console.error("[kassa-action]", e instanceof Error ? e.message : e);
  return { ok: false as const, error: e instanceof Error ? e.message : "Қате" };
};

export async function actAction(keys: string[], to: "senior" | "owner") {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Сессия аяқталған — қайта кіріңіз" };
    const r = await act(user, keys, to);
    revalidatePath(PATH);
    return { ok: true as const, count: r.count };
  } catch (e) {
    return fail(e);
  }
}

export async function closeDayAction(to: "senior" | "owner") {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Сессия аяқталған — қайта кіріңіз" };
    const r = await closeDay(user, to);
    revalidatePath(PATH);
    return { ok: true as const, count: r.count };
  } catch (e) {
    return fail(e);
  }
}

export async function kassaImportAction(dryRun: boolean) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Сессия аяқталған" };
    const r = await importKassaSheet(user, { dryRun });
    if (!dryRun) revalidatePath(PATH);
    return { ok: true as const, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function setSeniorAction(employeeId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Сессия аяқталған" };
    await setSenior(user, employeeId);
    revalidatePath(PATH);
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}

export async function setOpenFromAction(ymd: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Сессия аяқталған" };
    await setOpenFrom(user, ymd);
    revalidatePath(PATH);
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
