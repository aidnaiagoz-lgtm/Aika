import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/session";
import { isLeader, normalizePhone, MANAGER_ROLES, LOGIN_DOMAIN, loginSlug, displayLogin } from "@/lib/access";
import type { SessionUser } from "@/lib/session";

// Менеджер аккаунттарын басқару — тек CEO / ADMIN / РОП (isLeader).

export class ManagerError extends Error {}

function assertLeader(user: SessionUser) {
  if (!isLeader(user)) throw new ManagerError("Бұл әрекет тек CEO мен РОП-қа рұқсат етілген");
}

/** Оқуға оңай уақытша пароль: Ab-1234-cd (шатастыратын 0/O, 1/l әріптерсіз). */
export function generateTempPassword(): string {
  const L = "abcdefghjkmnpqrstuvwxyz";
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pick = (set: string) => set[randomInt(set.length)];
  const digits = String(randomInt(1000, 10000));
  return `${pick(U)}${pick(L)}-${digits}-${pick(L)}${pick(L)}`;
}

export async function listManagers() {
  return prisma.employee.findMany({
    where: { user: { userRoles: { some: { role: { name: { in: [...MANAGER_ROLES] } } } } } },
    include: { user: { include: { userRoles: { include: { role: true } } } }, branch: true },
    orderBy: { fullName: "asc" },
  });
}

async function uniqueSlugEmail(name: string): Promise<{ slug: string; email: string }> {
  const base = loginSlug(name);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}${i + 1}`;
    const email = `${slug}@${LOGIN_DOMAIN}`;
    if (!(await prisma.user.findUnique({ where: { email } }))) return { slug, email };
  }
  throw new ManagerError("Логин құру мүмкін болмады");
}

/**
 * Менеджер аккаунтын ашады. Телефон берілсе — телефонмен де кіре алады; әрқашан қысқа логин
 * ("zere") жасалады. Уақытша пароль тек осы жауапта қайтарылады (базада тек хэш).
 */
export async function createManager(
  actor: SessionUser,
  input: { fullName: string; phone?: string; email?: string; senior?: boolean }
) {
  assertLeader(actor);
  const fullName = input.fullName.trim();
  if (!fullName) throw new ManagerError("Аты-жөнін жазыңыз");
  let phone: string | null = null;
  if (input.phone && input.phone.trim()) {
    phone = normalizePhone(input.phone);
    if (!phone) throw new ManagerError("Телефон нөмірі дұрыс емес (мысалы: 8 701 123 45 67)");
  }
  const customEmail = input.email?.trim().toLowerCase();
  const { slug, email } = customEmail ? { slug: customEmail, email: customEmail } : await uniqueSlugEmail(fullName);

  const dup = await prisma.user.findFirst({ where: { OR: [...(phone ? [{ phone }] : []), { email }] } });
  if (dup) throw new ManagerError("Бұл телефон немесе email бұрын тіркелген");
  const nameDup = await prisma.employee.findFirst({ where: { fullName: { equals: fullName, mode: "insensitive" } } });
  if (nameDup) throw new ManagerError(`«${fullName}» атты қызметкер бар — Excel-дегідей бөлек ат беріңіз (мыс. «Жанерке 2»)`);

  const roleName = input.senior ? "SENIOR_SALES_MANAGER" : "SALES_MANAGER";
  const [role, dept, branch] = await Promise.all([
    prisma.role.findUnique({ where: { name: roleName } }),
    prisma.department.findFirst({ where: { slug: "sales" } }),
    prisma.branch.findFirst({ where: { name: { contains: "Алматы" } } }),
  ]);
  if (!role) throw new ManagerError(`${roleName} рөлі базада жоқ`);

  const tempPassword = generateTempPassword();
  const user = await prisma.user.create({
    data: {
      email,
      phone,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      employee: {
        create: {
          fullName,
          position: input.senior ? "Аға менеджер" : "Менеджер",
          departmentId: dept?.id,
          branchId: branch?.id,
        },
      },
      userRoles: { create: { roleId: role.id, departmentId: dept?.id } },
    },
  });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "CREATE", entityType: "User", entityId: user.id, newValue: { fullName, roleName, login: slug } },
  });
  return { login: displayLogin({ email, phone }), tempPassword, fullName };
}

/**
 * Excel импорты үшін: берілген аттар бойынша аккаунты жоқ менеджерлерге аккаунт ашады.
 * Бар болса — өткізіп жібереді (паролін өзгертпейді).
 */
export async function ensureManagers(actor: SessionUser, names: string[]) {
  assertLeader(actor);
  const created: Array<{ fullName: string; login: string; tempPassword: string }> = [];
  const existing: Array<{ fullName: string; login: string }> = [];
  for (const raw of [...new Set(names.map((n) => n.trim()).filter(Boolean))]) {
    const emp = await prisma.employee.findFirst({
      where: { fullName: { equals: raw, mode: "insensitive" } },
      include: { user: true },
    });
    if (emp) {
      existing.push({ fullName: emp.fullName, login: displayLogin(emp.user) });
      continue;
    }
    created.push(await createManager(actor, { fullName: raw }));
  }
  return { created, existing };
}

export async function resetManagerPassword(actor: SessionUser, userId: string) {
  assertLeader(actor);
  const target = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { employee: true, userRoles: { include: { role: true } } },
  });
  const tempPassword = generateTempPassword();
  // Менеджердің логині әлі қысқа логин болмаса (телефонмен/басқа email-мен ашылған) — аттан қысқа логинге
  // ("zere") ауыстырамыз, бәрінде бірдей болсын. Телефонмен кіру бұрынғыдай жұмыс істей береді.
  // Тек сатушы-менеджерлерге (басшылардың email-і өзгермейді).
  let email = target.email;
  const isManagerOnly = target.userRoles.length > 0 && target.userRoles.every((r) => (MANAGER_ROLES as readonly string[]).includes(r.role.name));
  const isShortLogin = email.endsWith("@" + LOGIN_DOMAIN) && !/^m7\d{10}@/.test(email);
  if (isManagerOnly && !isShortLogin && target.employee?.fullName) {
    email = (await uniqueSlugEmail(target.employee.fullName)).email;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { email, passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  // Ескі сессияларды жабамыз — ескі пароль біліп қалған адам кіре алмасын.
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "PASSWORD_RESET", entityType: "User", entityId: userId } });
  return {
    login: displayLogin({ email, phone: target.phone }),
    tempPassword,
    fullName: target.employee?.fullName ?? target.email,
  };
}

export async function setManagerBlocked(actor: SessionUser, userId: string, blocked: boolean) {
  assertLeader(actor);
  if (userId === actor.id) throw new ManagerError("Өзіңізді бұғаттай алмайсыз");
  await prisma.user.update({ where: { id: userId }, data: { status: blocked ? "SUSPENDED" : "ACTIVE" } });
  if (blocked) await prisma.session.deleteMany({ where: { userId } });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: blocked ? "BLOCK" : "UNBLOCK", entityType: "User", entityId: userId },
  });
}

export function formatPhone(phone: string): string {
  // 77011234567 → 8 701 123 45 67
  const d = phone.replace(/\D/g, "");
  if (d.length !== 11) return phone;
  return `8 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

/** Seed-тегі demo сатушы (рейтингке кірмеуі үшін) — бар болса бұғаттайды. */
export const DEMO_MANAGER_EMAIL = "sales.manager@automax.kz";
export async function blockDemoManager(actor: SessionUser) {
  assertLeader(actor);
  const demo = await prisma.user.findUnique({ where: { email: DEMO_MANAGER_EMAIL } });
  if (!demo || demo.status !== "ACTIVE") return false;
  await setManagerBlocked(actor, demo.id, true);
  return true;
}
