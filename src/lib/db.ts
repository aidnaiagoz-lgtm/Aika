import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Vercel-де әр функция данасы өз қосылым пулын ашады; әдепкі пул (CPU×2+1) бірнеше данада базаның шегін тез толтырады —
 * 2026-11-21: «too many connections for role …» → сайт ашылмай қалды. URL-де connection_limit жоқ болса — 2-мен шектейміз.
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || process.env.NODE_ENV !== "production") return undefined;
  try {
    const u = new URL(raw);
    if (!u.protocol.startsWith("postgres")) return undefined; // prisma:// (Accelerate) — өз пулы бар
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "2");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    return u.toString();
  } catch {
    return undefined;
  }
}

const url = datasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(url ? { datasourceUrl: url } : {}),
  });

// Бір дана ішінде бір ғана клиент (prod-та да) — модуль қайта жүктелсе жаңа пул ашылмасын
globalForPrisma.prisma = prisma;

export * from "@prisma/client";
