"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  activateWorkshop,
  addWorker,
  almatyTodayStart,
  closeStaleJobs,
  finishJob,
  reopenJob,
  setRate,
  setWorkerActive,
  startJob,
  updateJob,
  WorkshopError,
  type JobPatch,
} from "@/lib/domain/workshop";
import type { Operation } from "@/lib/domain/workshop/calc";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function run(fn: (user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<unknown>, paths = ["/workshop"]): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    await fn(user);
    for (const p of paths) revalidatePath(p, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof WorkshopError) return { ok: false, error: e.message };
    console.error("[workshop] action", e instanceof Error ? e.message : e);
    return { ok: false, error: "Сақталмады — қайта байқап көріңіз" };
  }
}

export async function updateJobAction(id: string, patch: JobPatch) {
  return run((u) => updateJob(u, id, patch));
}

export async function startJobAction(id: string) {
  return run((u) => startJob(u, id), ["/workshop", "/orders"]);
}

/** CEO: бүгінге дейін түсіп, «Жаңа»/«Тігіліп жатыр» күйінде қалған ескі тапсырмаларды жабу. */
export async function closeStaleJobsAction() {
  return run((u) => closeStaleJobs(u, almatyTodayStart()), ["/workshop", "/orders"]);
}

export async function finishJobAction(id: string) {
  return run((u) => finishJob(u, id), ["/workshop", "/orders", "/departments/sales/almaty"]);
}

export async function reopenJobAction(id: string) {
  return run((u) => reopenJob(u, id), ["/workshop", "/orders"]);
}

export async function activateWorkshopAction() {
  return run((u) => activateWorkshop(u));
}

export async function addWorkerAction(name: string) {
  return run((u) => addWorker(u, name), ["/workshop", "/workshop/workers"]);
}

export async function setWorkerActiveAction(id: string, active: boolean) {
  return run((u) => setWorkerActive(u, id, active), ["/workshop", "/workshop/workers"]);
}

export async function setRateAction(op: Operation, price: number) {
  return run((u) => setRate(u, op, price), ["/workshop/pay"]);
}
