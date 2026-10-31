"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, SESSION_COOKIE } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=empty");
  }

  const user = await prisma.user.findUnique({ where: { email } });
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

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id },
  });

  redirect("/dashboard");
}
