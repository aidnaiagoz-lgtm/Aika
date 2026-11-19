"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { answerLekala, LekalaError, lookupLekala, requestLekala, setMark, type LekalaAnswer, type LekalaLookup } from "@/lib/domain/lekala";

type R = { ok: true } | { ok: false; error: string };

/** Жаңа заказ: марка+модель бойынша лекала бар-жоғы. */
export async function lookupLekalaAction(make: string, model: string, year: number | null): Promise<LekalaLookup | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return lookupLekala(String(make).slice(0, 60), String(model).slice(0, 80), year);
}

/** Менеджер: «Цехтан сұрау». */
export async function requestLekalaAction(make: string, model: string, year: number | null): Promise<{ ok: true; data: LekalaLookup | null } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    await requestLekala(user, String(make).slice(0, 60), String(model).slice(0, 80), year);
    revalidatePath("/lekala");
    return { ok: true, data: await lookupLekala(make, model, year) };
  } catch (e) {
    if (e instanceof LekalaError) return { ok: false, error: e.message };
    console.error("[lekala] request", e instanceof Error ? e.message : e);
    return { ok: false, error: "Жіберілмеді — қайта байқап көріңіз" };
  }
}

async function run(fn: (u: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<unknown>): Promise<R> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    await fn(user);
    revalidatePath("/lekala");
    return { ok: true };
  } catch (e) {
    if (e instanceof LekalaError) return { ok: false, error: e.message };
    console.error("[lekala] action", e instanceof Error ? e.message : e);
    return { ok: false, error: "Сақталмады — қайта байқап көріңіз" };
  }
}

export async function answerLekalaAction(requestId: string, answer: LekalaAnswer) {
  return run((u) => answerLekala(u, requestId, answer));
}

export async function setMarkAction(make: string, model: string, status: "HAVE" | "NONE") {
  return run((u) => setMark(u, make, model, status));
}
