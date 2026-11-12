"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, SESSION_COOKIE } from "@/lib/session";
import { homePathFor, loginLookup, isSalesManagerOnly, isWorkshopOnly, isManagedAccount, MODE_COOKIE } from "@/lib/access";
import { sealPassword, openPassword } from "@/lib/domain/managers/vault";

export async function loginAction(formData: FormData) {
  // Логин — email немесе телефон нөмірі (менеджерлер телефонмен кіреді).
  const login = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    redirect("/login?error=empty");
  }

  // email / телефон / қысқа логин ("zere")
  const lookup = loginLookup(login);
  if (!lookup) redirect("/login?error=invalid");
  const user = await prisma.user.findFirst({
    where: lookup,
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
  const mode = isSalesManagerOnly(user) ? "manager" : isWorkshopOnly(user) ? "workshop" : null;
  if (mode) {
    cookieStore.set(MODE_COOKIE, mode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
  } else {
    cookieStore.delete(MODE_COOKIE);
  }

  // Менеджердің паролін CEO көруі үшін шифрланған көшірмені жаңартамыз (бұрын жоқ болса — алғашқы кіруде жазылады)
  const sealed = isManagedAccount(user) && openPassword(user.passwordEnc) !== password ? sealPassword(password) : undefined;
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), ...(sealed ? { passwordEnc: sealed } : {}) } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id },
  });

  redirect(user.mustChangePassword ? "/change-password" : homePathFor(user));
}
