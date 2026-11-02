"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/session";
import { homePathFor } from "@/lib/access";

export async function changePasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!(await verifyPassword(user.passwordHash, current))) redirect("/change-password?error=current");
  if (next.length < 8) redirect("/change-password?error=short");
  if (next !== repeat) redirect("/change-password?error=mismatch");
  if (next === current) redirect("/change-password?error=same");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "PASSWORD_CHANGE", entityType: "User", entityId: user.id },
  });

  redirect(homePathFor(user) + "?pw=ok");
}
