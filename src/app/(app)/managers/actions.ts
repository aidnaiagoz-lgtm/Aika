"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createManager, resetManagerPassword, setManagerBlocked, ManagerError } from "@/lib/domain/managers";

export type CredentialState =
  | { ok: true; fullName: string; login: string; tempPassword: string; kind: "created" | "reset" }
  | { ok: false; error: string }
  | null;

export async function createManagerAction(_prev: CredentialState, formData: FormData): Promise<CredentialState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған" };
  try {
    const res = await createManager(user, {
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      senior: formData.get("senior") === "on",
    });
    revalidatePath("/managers");
    return { ok: true, kind: "created", ...res };
  } catch (e) {
    return { ok: false, error: e instanceof ManagerError ? e.message : "Аккаунт ашу мүмкін болмады" };
  }
}

export async function resetPasswordAction(_prev: CredentialState, formData: FormData): Promise<CredentialState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған" };
  try {
    const res = await resetManagerPassword(user, String(formData.get("userId")));
    return { ok: true, kind: "reset", login: res.login, tempPassword: res.tempPassword, fullName: res.fullName };
  } catch (e) {
    return { ok: false, error: e instanceof ManagerError ? e.message : "Парольді жаңарту мүмкін болмады" };
  }
}

export async function toggleBlockAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  await setManagerBlocked(user, String(formData.get("userId")), formData.get("block") === "1");
  revalidatePath("/managers");
}
