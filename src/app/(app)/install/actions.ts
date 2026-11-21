"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { pickUpJob, WorkshopError } from "@/lib/domain/workshop";

/** Орнатушы: «Алып кеттім». */
export async function pickUpAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    await pickUpJob(user, id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof WorkshopError ? e.message : "Белгіленбеді" };
  }
}
