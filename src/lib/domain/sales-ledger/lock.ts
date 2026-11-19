import "server-only";
import { prisma } from "@/lib/db";

const LOCK_KEY = "sales.ledgerSyncLock";
const LOCK_LEASE_MS = 90_000;
const stamp = (ms: number) => String(ms).padStart(15, "0");

/**
 * Продажи жолдарын жазу құлпы (AppSetting арқылы, ұзақ транзакциясыз): мерзімі өткен немесе бос болса ғана алынады.
 * 25 секунд ішінде алынбаса — қате (келесі синхрондау қайта байқайды). Құлып 90 сек өзі босайды (процесс құласа да).
 */
export async function withLedgerLock<T>(fn: () => Promise<T>): Promise<T> {
  await prisma.appSetting.createMany({ data: [{ key: LOCK_KEY, value: stamp(0) }], skipDuplicates: true });
  const deadline = Date.now() + 25_000;
  let token: string | null = null;
  while (!token) {
    const now = Date.now();
    const mine = stamp(now + LOCK_LEASE_MS);
    const got = await prisma.appSetting.updateMany({ where: { key: LOCK_KEY, value: { lt: stamp(now) } }, data: { value: mine } });
    if (got.count === 1) token = mine;
    else if (Date.now() > deadline) throw new Error("Продажи синхрондауы бос емес — сәлден соң қайталанады");
    else await new Promise((r) => setTimeout(r, 400));
  }
  try {
    return await fn();
  } finally {
    await prisma.appSetting.updateMany({ where: { key: LOCK_KEY, value: token }, data: { value: stamp(0) } }).catch(() => undefined);
  }
}

