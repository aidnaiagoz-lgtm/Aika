import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";

/**
 * Телефонға хабарлама (Web Push). VAPID кілттері бірінші қолданғанда жасалып, базада (AppSetting)
 * сақталады — env-ке қосымша құпия керек емес. Хабарда клиенттің аты/телефоны болмауы керек
 * (құлыпталған экранда көрінеді).
 */

const KEY = "push.vapid";
const SUBJECT = "https://automax-erp.vercel.app";

type Vapid = { publicKey: string; privateKey: string };
let cached: Vapid | null = null;

async function vapid(): Promise<Vapid> {
  if (cached) return cached;
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (row) {
    cached = JSON.parse(row.value) as Vapid;
    return cached;
  }
  const keys = webpush.generateVAPIDKeys();
  // Бір уақытта екі сұраныс болса — біріншісі жазылады, екіншісі соны оқиды
  await prisma.appSetting.createMany({ data: [{ key: KEY, value: JSON.stringify(keys) }], skipDuplicates: true });
  const saved = await prisma.appSetting.findUniqueOrThrow({ where: { key: KEY } });
  cached = JSON.parse(saved.value) as Vapid;
  return cached;
}

export async function vapidPublicKey(): Promise<string> {
  return (await vapid()).publicKey;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(userId: string, sub: PushSubscriptionInput, userAgent?: string | null) {
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("Жазылым дұрыс емес");
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
  });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function hasSubscription(userId: string) {
  return (await prisma.pushSubscription.count({ where: { userId } })) > 0;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Берілген пайдаланушылардың барлық құрылғыларына жібереді. Ескірген жазылымдар өшіріледі. */
export async function sendPushToUsers(userIds: string[], msg: PushMessage): Promise<{ sent: number; removed: number }> {
  if (userIds.length === 0) return { sent: 0, removed: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds }, user: { status: "ACTIVE" } } });
  if (subs.length === 0) return { sent: 0, removed: 0 };
  const keys = await vapid();
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  const payload = JSON.stringify(msg);
  let sent = 0, removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600, urgency: "high" });
        sent++;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastOkAt: new Date() } });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          removed++;
        } else {
          console.error("[push] send failed", code ?? (e instanceof Error ? e.message : e));
        }
      }
    }),
  );
  return { sent, removed };
}
