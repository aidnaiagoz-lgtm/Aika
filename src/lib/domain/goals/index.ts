import "server-only";
import { prisma } from "@/lib/db";
import { isLeader, MANAGER_ROLES } from "@/lib/access";
import type { SessionUser } from "@/lib/session";

// Айлық мақсаттар: команда (тауар саны + сыйлық мәтіні) және әр менеджердің жеке мақсаты.

export function currentMonth(now = new Date()) {
  return new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7); // Алматы
}
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

async function itemsByManager(month: string) {
  const from = new Date(month + "-01T00:00:00Z");
  const to = new Date(shiftMonth(month, 1) + "-01T00:00:00Z");
  const rows = await prisma.salesLedgerRow.findMany({
    where: { date: { gte: from, lt: to }, NOT: { orderStatus: { contains: "возврат", mode: "insensitive" } } },
    select: { manager: true, product: true, createdBy: { select: { fullName: true } } },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.product?.trim()) continue;
    const key = (r.manager || r.createdBy?.fullName || "").trim().toLocaleLowerCase("ru");
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export async function getGoalsPage(month: string) {
  const [managers, goal, prevGoal] = await Promise.all([
    prisma.employee.findMany({
      where: { user: { status: "ACTIVE", userRoles: { some: { role: { name: { in: [...MANAGER_ROLES] } } } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.salesGoal.findUnique({ where: { month }, include: { personal: true } }),
    prisma.salesGoal.findUnique({ where: { month: shiftMonth(month, -1) }, include: { personal: true } }),
  ]);
  const m1 = shiftMonth(month, -1);
  const [a1, a2, a3, aCur] = await Promise.all([
    itemsByManager(m1),
    itemsByManager(shiftMonth(month, -2)),
    itemsByManager(shiftMonth(month, -3)),
    itemsByManager(month),
  ]);
  const key = (n: string) => n.trim().toLocaleLowerCase("ru");
  const rows = managers.map((e) => {
    const k = key(e.fullName);
    const last3 = [a1.get(k) ?? 0, a2.get(k) ?? 0, a3.get(k) ?? 0];
    const avg = last3.reduce((t, n) => t + n, 0) / 3;
    return {
      employeeId: e.id,
      name: e.fullName,
      prevMonthItems: a1.get(k) ?? 0,
      currentItems: aCur.get(k) ?? 0,
      suggestion: Math.max(1, Math.round(avg * 1.1)),
      goal: goal?.personal.find((p) => p.employeeId === e.id)?.items ?? null,
      prevGoal: prevGoal?.personal.find((p) => p.employeeId === e.id)?.items ?? null,
    };
  });
  const teamSuggestion = rows.reduce((t, r) => t + r.suggestion, 0);

  // Тарих: соңғы 4 ай — мақсат vs нәтиже
  const history = [];
  for (let n = -4; n <= -1; n++) {
    const m = shiftMonth(month, n);
    const g = await prisma.salesGoal.findUnique({ where: { month: m } });
    const done = [...(await itemsByManager(m)).values()].reduce((t, x) => t + x, 0);
    history.push({ month: m, goal: g?.teamItems ?? null, done });
  }

  return {
    month,
    rows,
    team: goal ? { teamItems: goal.teamItems, reward: goal.reward ?? "" } : null,
    prevTeam: prevGoal ? { teamItems: prevGoal.teamItems, reward: prevGoal.reward ?? "" } : null,
    teamSuggestion,
    history,
  };
}

export async function saveGoals(
  actor: SessionUser,
  input: { month: string; teamItems: number; reward: string; personal: Array<{ employeeId: string; items: number | null }> }
) {
  if (!isLeader(actor)) throw new Error("Мақсатты тек CEO мен РОП қоя алады");
  if (!/^\d{4}-\d{2}$/.test(input.month)) throw new Error("Ай форматы қате");
  if (!Number.isFinite(input.teamItems) || input.teamItems < 1) throw new Error("Команда мақсаты 1-ден кем болмауы керек");

  const goal = await prisma.salesGoal.upsert({
    where: { month: input.month },
    update: { teamItems: input.teamItems, reward: input.reward || null, updatedById: actor.id },
    create: { month: input.month, teamItems: input.teamItems, reward: input.reward || null, updatedById: actor.id },
  });
  for (const p of input.personal) {
    if (p.items === null || !Number.isFinite(p.items) || p.items < 1) {
      await prisma.salesGoalPersonal.deleteMany({ where: { goalId: goal.id, employeeId: p.employeeId } });
    } else {
      await prisma.salesGoalPersonal.upsert({
        where: { goalId_employeeId: { goalId: goal.id, employeeId: p.employeeId } },
        update: { items: p.items },
        create: { goalId: goal.id, employeeId: p.employeeId, items: p.items },
      });
    }
  }
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "EDIT", entityType: "SalesGoal", entityId: goal.id, newValue: input as object },
  });
}
