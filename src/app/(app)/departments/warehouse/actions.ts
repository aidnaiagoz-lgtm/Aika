"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMaterial, adjustStock, updateMaterial, deactivateMaterial } from "@/lib/domain/warehouse";
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

export async function createMaterialAction(formData: FormData) {
  const user = await requireUser();
  await runOrRedirectWithError(
    () =>
      createMaterial(user, {
        sku: String(formData.get("sku")),
        category: String(formData.get("category")),
        name: String(formData.get("name")),
        color: String(formData.get("color") ?? "") || undefined,
        type: String(formData.get("type") ?? "") || undefined,
        unit: String(formData.get("unit") ?? "") || undefined,
        initialStock: Number(formData.get("initialStock") ?? 0),
        costPrice: Number(formData.get("costPrice") ?? 0),
        supplier: String(formData.get("supplier") ?? "") || undefined,
      }),
    "/departments/warehouse"
  );
  revalidatePath("/departments/warehouse");
}

export async function adjustStockAction(formData: FormData) {
  const user = await requireUser();
  const materialId = String(formData.get("materialId"));
  const direction = String(formData.get("direction"));
  const amount = Math.abs(Number(formData.get("amount") ?? 0));
  const reason = String(formData.get("reason") ?? "");
  const delta = direction === "out" ? -amount : amount;
  await runOrRedirectWithError(() => adjustStock(user, materialId, delta, reason), "/departments/warehouse");
  revalidatePath("/departments/warehouse");
}

export async function updateMaterialAction(formData: FormData) {
  const user = await requireUser();
  const materialId = String(formData.get("materialId"));
  await runOrRedirectWithError(
    () =>
      updateMaterial(user, materialId, {
        name: String(formData.get("name") ?? ""),
        color: String(formData.get("color") ?? ""),
        type: String(formData.get("type") ?? ""),
        unit: String(formData.get("unit") ?? ""),
        costPrice: Number(formData.get("costPrice") ?? 0),
        supplier: String(formData.get("supplier") ?? ""),
      }),
    "/departments/warehouse"
  );
  revalidatePath("/departments/warehouse");
}

export async function deactivateMaterialAction(formData: FormData) {
  const user = await requireUser();
  const materialId = String(formData.get("materialId"));
  await runOrRedirectWithError(() => deactivateMaterial(user, materialId), "/departments/warehouse");
  revalidatePath("/departments/warehouse");
}
