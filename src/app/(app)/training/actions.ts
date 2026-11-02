"use server";

import { revalidatePath } from "next/cache";
import { createTrainingFolder, type TrainingSection } from "@/lib/domain/training";
import { getCurrentUser } from "@/lib/auth";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Сессия аяқталған");
  return user;
}

export async function createTrainingFolderAction(formData: FormData) {
  const user = await requireUser();
  const section = String(formData.get("section")) as TrainingSection;
  const name = String(formData.get("name") ?? "");
  await createTrainingFolder(user.id, section, name);
  revalidatePath(`/training/${section}`);
}
