import "server-only";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  return getSessionUser(sessionId);
}
