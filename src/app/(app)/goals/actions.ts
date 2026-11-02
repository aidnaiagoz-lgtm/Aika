"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { saveGoals } from "@/lib/domain/goals";

export async function saveGoalsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const month = String(formData.get("month"));
  const ids = formData.getAll("employeeId").map(String);
  const personal = ids.map((employeeId) => {
    const raw = String(formData.get(`goal_${employeeId}`) ?? "").trim();
    return { employeeId, items: raw === "" ? null : Number(raw) };
  });
  try {
    await saveGoals(user, {
      month,
      teamItems: Number(formData.get("teamItems")),
      reward: String(formData.get("reward") ?? "").trim(),
      personal,
    });
  } catch (e) {
    redirect(`/goals?m=${month}&error=${encodeURIComponent(e instanceof Error ? e.message : "Сақталмады")}`);
  }
  revalidatePath("/goals");
  revalidatePath("/rating");
  redirect(`/goals?m=${month}&saved=1`);
}
