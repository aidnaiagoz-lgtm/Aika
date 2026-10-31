"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assignProductionWorker, setWorkshop, advanceProductionStage } from "@/lib/domain/production";
import { recordQualityCheck } from "@/lib/domain/orders";
import { getCurrentUser } from "@/lib/auth";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Сессия аяқталған");
  return user;
}

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

export async function assignWorkerAction(formData: FormData) {
  const user = await requireUser();
  const productionOrderId = String(formData.get("productionOrderId"));
  const workerId = String(formData.get("workerId") ?? "");
  await runOrRedirectWithError(() => assignProductionWorker(user, productionOrderId, workerId), "/departments/production");
  revalidatePath("/departments/production");
}

export async function setWorkshopAction(formData: FormData) {
  const user = await requireUser();
  const productionOrderId = String(formData.get("productionOrderId"));
  const workshop = String(formData.get("workshop") ?? "");
  await runOrRedirectWithError(() => setWorkshop(user, productionOrderId, workshop), "/departments/production");
  revalidatePath("/departments/production");
}

export async function advanceStageAction(formData: FormData) {
  const user = await requireUser();
  const productionOrderId = String(formData.get("productionOrderId"));
  const toStatus = String(formData.get("toStatus"));
  await runOrRedirectWithError(() => advanceProductionStage(user, productionOrderId, toStatus), "/departments/production");
  revalidatePath("/departments/production");
}

export async function recordQualityCheckAction(formData: FormData) {
  const user = await requireUser();
  const productionOrderId = String(formData.get("productionOrderId"));
  const result = String(formData.get("result")) as "PASSED" | "FAILED" | "REWORK_REQUIRED";
  const comment = String(formData.get("comment") ?? "") || undefined;
  await runOrRedirectWithError(() => recordQualityCheck(user, productionOrderId, result, comment), "/departments/production");
  revalidatePath("/departments/production");
}
