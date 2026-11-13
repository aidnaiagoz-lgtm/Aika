"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { canUseWorkshop } from "@/lib/access";
import { removeSubscription, saveSubscription, sendPushToUsers, vapidPublicKey, type PushSubscriptionInput } from "@/lib/push";

export async function getPushKeyAction(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !canUseWorkshop(user)) return null;
  return vapidPublicKey();
}

export async function subscribePushAction(sub: PushSubscriptionInput): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
  if (!canUseWorkshop(user)) return { ok: false, error: "Рұқсат жоқ" };
  try {
    await saveSubscription(user.id, sub, (await headers()).get("user-agent"));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Сақталмады" };
  }
}

export async function unsubscribePushAction(endpoint: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  await removeSubscription(user.id, endpoint);
  return { ok: true };
}

export async function testPushAction(): Promise<{ ok: boolean; sent: number }> {
  const user = await getCurrentUser();
  if (!user || !canUseWorkshop(user)) return { ok: false, sent: 0 };
  const r = await sendPushToUsers([user.id], { title: "AutoMax", body: "Хабарлама жұмыс істеп тұр ✓", url: "/workshop", tag: "test" });
  return { ok: r.sent > 0, sent: r.sent };
}
