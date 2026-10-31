"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destroySession, SESSION_COOKIE } from "@/lib/session";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

export async function logoutAction() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) await destroySession(sessionId);
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setLocaleAction(formData: FormData) {
  const locale = formData.get("locale");
  if (typeof locale !== "string" || !isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
