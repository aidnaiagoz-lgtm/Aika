import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "automax_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 күн

export async function createSession(userId: string, meta?: { ipAddress?: string; userAgent?: string }) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { id, userId, expiresAt, ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
  });
  return { id, expiresAt };
}

export async function getSessionUser(sessionId: string | undefined) {
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          employee: { include: { department: true, branch: true } },
          userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function destroySession(sessionId: string) {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
