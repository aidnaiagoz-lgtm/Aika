"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import {
  addTrainingLink,
  createTrainingFolder,
  deleteTrainingFolder,
  deleteTrainingMaterial,
  isTrainingSection,
  renameTrainingFolder,
  TrainingError,
  type TrainingSection,
} from "@/lib/domain/training";

export type TrainingActionResult = { ok: true; redirectTo?: string } | { ok: false; error: string };

function refresh(section: TrainingSection) {
  revalidatePath(`/training/${section}`, "layout");
  revalidatePath(`/departments/${section}`);
}

async function run(fn: (user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<TrainingActionResult>): Promise<TrainingActionResult> {
  const t = getDictionary(await getLocale());
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: t.training.genericError };
  try {
    return await fn(user);
  } catch (e) {
    if (e instanceof TrainingError) return { ok: false, error: t.training.errors[e.code] ?? t.training.genericError };
    console.error("[training]", e instanceof Error ? e.message : e);
    return { ok: false, error: t.training.genericError };
  }
}

const sectionOf = (raw: unknown): TrainingSection => {
  const s = String(raw ?? "");
  if (!isTrainingSection(s)) throw new TrainingError("folderNotFound");
  return s;
};

export async function createTrainingFolderAction(formData: FormData): Promise<TrainingActionResult> {
  return run(async (user) => {
    const section = sectionOf(formData.get("section"));
    const parentId = String(formData.get("parentId") ?? "") || null;
    await createTrainingFolder(user.id, section, String(formData.get("name") ?? ""), parentId);
    refresh(section);
    return { ok: true };
  });
}

export async function renameTrainingFolderAction(section: string, id: string, name: string): Promise<TrainingActionResult> {
  return run(async (user) => {
    const s = sectionOf(section);
    await renameTrainingFolder(user, id, name);
    refresh(s);
    return { ok: true };
  });
}

export async function deleteTrainingFolderAction(section: string, id: string): Promise<TrainingActionResult> {
  return run(async (user) => {
    const s = sectionOf(section);
    const folder = await deleteTrainingFolder(user, id);
    refresh(s);
    return { ok: true, redirectTo: folder.parentId ? `/training/${s}/${folder.parentId}` : `/training/${s}` };
  });
}

export async function addTrainingLinkAction(formData: FormData): Promise<TrainingActionResult> {
  return run(async (user) => {
    const section = sectionOf(formData.get("section"));
    await addTrainingLink(user.id, String(formData.get("folderId") ?? ""), String(formData.get("title") ?? ""), String(formData.get("url") ?? ""));
    refresh(section);
    return { ok: true };
  });
}

export async function deleteTrainingMaterialAction(section: string, id: string): Promise<TrainingActionResult> {
  return run(async (user) => {
    const s = sectionOf(section);
    await deleteTrainingMaterial(user, id);
    refresh(s);
    return { ok: true };
  });
}
