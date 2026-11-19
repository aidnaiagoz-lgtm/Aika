"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { addReceiptPhoto, applyMoySklad, createReceipt, previewMoySklad, saveMaterialPhotos, setMaterialPhoto, StockError, updateMaterialStockSettings, type PhotoFile, type ReceiptInput } from "@/lib/domain/warehouse/stock";
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

async function filesOf(form: FormData): Promise<PhotoFile[]> {
  const out: PhotoFile[] = [];
  for (const v of form.getAll("files")) {
    if (typeof v === "string") continue;
    out.push({ name: v.name, mime: v.type, data: Buffer.from(await v.arrayBuffer()) });
  }
  return out;
}

/** Бірнеше фото (атауы — код). */
export async function uploadPhotosAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    const r = await saveMaterialPhotos(user, await filesOf(form));
    revalidatePath("/warehouse", "layout");
    return { ok: true as const, ...r };
  } catch (e) {
    if (e instanceof StockError) return { ok: false as const, error: e.message };
    if (e instanceof ForbiddenError) return { ok: false as const, error: "Рұқсат жоқ" };
    console.error("[stock] photos", e instanceof Error ? e.message : e);
    return { ok: false as const, error: "Фото сақталмады" };
  }
}

/** Бір материалдың фотосы. */
export async function setMaterialPhotoAction(materialId: string, form: FormData) {
  return run(async (u) => {
    const [f] = await filesOf(form);
    if (!f) throw new StockError("Фотоны таңдаңыз");
    await setMaterialPhoto(u, materialId, f);
  });
}

/** Накладнаның фотосы (бір-бірден жіберіледі — әрқайсысы браузерде кішірейтілген). */
export async function addReceiptPhotoAction(receiptId: string, form: FormData) {
  return run(async (u) => {
    const [f] = await filesOf(form);
    if (!f) throw new StockError("Фотоны таңдаңыз");
    await addReceiptPhoto(u, receiptId, f);
  });
}
