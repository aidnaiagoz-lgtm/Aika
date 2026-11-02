"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, SESSION_COOKIE } from "@/lib/session";
import { homePathFor, normalizePhone, isSalesManagerOnly, MODE_COOKIE } from "@/lib/access";

export async function loginAction(formData: FormData) {
  // Логин — email немесе телефон нөмірі (менеджерлер телефонмен кіреді).
  const login = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    redirect("/login?error=empty");
  }

  const phone = login.includes("@") ? null : normalizePhone(login);
  const user = await prisma.user.findFirst({
    where: phone ? { phone } : { email: login },
    include: { userRoles: { include: { role: true } } },
  });
  const passwordOk = user ? await verifyPassword(user.passwordHash, password) : false;

  if (!user || user.status !== "ACTIVE" || !passwordOk) {
    redirect("/login?error=invalid");
  }

  const session = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  if (isSalesManagerOnly(user)) {
    cookieStore.set(MODE_COOKIE, "manager", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
  } else {
    cookieStore.delete(MODE_COOKIE);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id },
  });

  redirect(user.mustChangePassword ? "/change-password" : homePathFor(user));
}
