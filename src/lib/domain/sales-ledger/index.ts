import { prisma, PermissionAction } from "@/lib/db";
import { assertPermission } from "@/lib/rbac";
import type { ActingUser } from "../sales/types";
import type { LedgerRowInput } from "./types";

export * from "./types";

// Sales Ledger — Алматы (және кейін басқа филиалдар) үшін нақты Google Sheets кестесінің
// құрылымын қайталайтын жұмыс журналы. Бөлек "orders" resource жоқ — Sales-тің "deals"
// рұқсаты қолданылады (§ domain/orders-тегі шешіммен бірдей логика).

const DATE_FIELDS = ["date", "readyOrderDate", "receipt1At", "receipt2At", "receipt3At"] as const;

function toPrismaData(input: LedgerRowInput): Record<string, unknown> {
  const data: Record<string, unknown> = { ...input };
  for (const field of DATE_FIELDS) {
    if (input[field]) data[field] = new Date(input[field] as string);
    else if (field in input) data[field] = null;
  }
  return data;
}

/**
 * № — кестеде көрінетін жол санына қарап есептеледі (MAX(no)+1), DB sequence емес.
 * Сондықтан "кестеде 2 жазба бар болса, келесісі 3" әрқашан көзге көрінгенмен сәйкес
 * келеді — жазба өшірілсе, келесі нөмір де соған қарай төмендейді.
 */
async function nextNo(branchId: string): Promise<number> {
  const result = await prisma.salesLedgerRow.aggregate({ where: { branchId }, _max: { no: true } });
  return (result._max.no ?? 0) + 1;
}

/** Жолды өзгерте ала ма: OWN scope болса — тек өзі енгізген жол. */
export function canEditLedgerRow(user: ActingUser, row: { createdById: string | null }): boolean {
  const scope = user.userRoles
    .flatMap((ur) => ur.role.rolePermissions)
    .filter((rp) => rp.permission.resource === "deals" && rp.permission.action === "EDIT")
    .map((rp) => rp.scope);
  if (scope.length === 0) return false;
  if (scope.some((s) => s !== "OWN")) return true;
  return row.createdById !== null && row.createdById === user.employee?.id;
}

/** Жолды өшіре ала ма: менеджер (OWN) өшіре алмайды — тек басшылар. */
export function canDeleteLedgerRow(user: ActingUser): boolean {
  return user.userRoles
    .flatMap((ur) => ur.role.rolePermissions)
    .some((rp) => rp.permission.resource === "deals" && rp.permission.action === "DELETE" && rp.scope !== "OWN");
}

/**
 * Менеджер (OWN scope) «Менеджер» бағанын өзі толтыра алады, бірақ тек өз атымен — рейтинг осы баған бойынша
 * есептеледі, басқаның атын жазу сатылымды соған аударып жібереді. Бос қалдырса — өз аты қойылады.
 * CEO / РОП кез келген атты жаза алады.
 */
function enforceOwnManagerName(user: ActingUser, scope: string, input: LedgerRowInput): LedgerRowInput {
  if (scope !== "OWN") return input;
  const name = user.employee?.fullName;
  if (!name) return input;
  const given = (input as { manager?: unknown }).manager;
  const norm = (v: string) => v.trim().toLocaleLowerCase("ru");
  if (typeof given === "string" && given.trim() && norm(given) !== norm(name)) {
    throw new Error(`«Менеджер» бағанына тек өз атыңызды жаза аласыз — «${name}»`);
  }
  return { ...input, manager: name };
}

export async function previewNextNo(branchId: string): Promise<number> {
  return nextNo(branchId);
}

/**
 * Бизнес шешімі (2026-11): кестені барлық менеджер толық көреді (бір-бірімен жарысу үшін),
 * бірақ ӨЗГЕРТУ — тек өз жолын (scope=OWN). Сондықтан VIEW мұнда scope бойынша сүзілмейді.
 */
export async function listLedgerRows(user: ActingUser, branchId: string, opts: { month?: string; onlyMine?: boolean } = {}) {
  assertPermission(user, "deals", PermissionAction.VIEW);
  // Ай бойынша сүзу — 12 мың жол бір бетке сыймайды. month = "2026-11".
  const dateFilter = opts.month
    ? {
        date: {
          gte: new Date(opts.month + "-01T00:00:00Z"),
          lt: new Date(new Date(opts.month + "-01T00:00:00Z").setUTCMonth(Number(opts.month.slice(5, 7)))),
        },
      }
    : {};
  const mine = opts.onlyMine && user.employee ? { createdById: user.employee.id } : {};
  return prisma.salesLedgerRow.findMany({
    where: { branchId, ...dateFilter, ...mine },
    include: { createdBy: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function getLedgerRow(user: ActingUser, id: string) {
  assertPermission(user, "deals", PermissionAction.VIEW);
  return prisma.salesLedgerRow.findUniqueOrThrow({ where: { id } });
}

export async function createLedgerRow(user: ActingUser, branchId: string, input: LedgerRowInput) {
  const scope = assertPermission(user, "deals", PermissionAction.CREATE);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы жазба қоса алады");
  input = enforceOwnManagerName(user, scope, input);

  const row = await prisma.salesLedgerRow.create({
    data: { branchId, createdById: user.employee.id, no: await nextNo(branchId), ...toPrismaData(input) },
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "CREATE", entityType: "SalesLedgerRow", entityId: row.id, newValue: input as object },
  });

  return row;
}

export async function updateLedgerRow(user: ActingUser, id: string, input: LedgerRowInput) {
  const scope = assertPermission(user, "deals", PermissionAction.EDIT);
  const existing = await prisma.salesLedgerRow.findUniqueOrThrow({ where: { id } });
  if (scope === "OWN" && existing.createdById !== user.employee?.id) {
    throw new Error("Тек өз жазбаңызды өзгерте аласыз");
  }
  input = enforceOwnManagerName(user, scope, input);

  const row = await prisma.salesLedgerRow.update({ where: { id }, data: toPrismaData(input) });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "EDIT", entityType: "SalesLedgerRow", entityId: id, newValue: input as object },
  });

  return row;
}

export async function deleteLedgerRow(user: ActingUser, id: string) {
  const scope = assertPermission(user, "deals", PermissionAction.DELETE);
  if (scope === "OWN") {
    // Бизнес шешімі: менеджер жолды өшіре алмайды (тек CEO/РОП) — қате жазса, түзетеді.
    throw new Error("Жолды тек CEO немесе РОП өшіре алады");
  }

  await prisma.salesLedgerRow.delete({ where: { id } });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "DELETE", entityType: "SalesLedgerRow", entityId: id },
  });
}

/**
 * Ашылмалы тізімдер: әр бағанның бұрын енгізілген мәндері (соңғы 1 жыл, жиілігі бойынша),
 * және «Товар → Цена» (ең соңғы баға) — тауарды таңдағанда бағасы өздігінен қойылады.
 */
export async function getLedgerOptions(branchId: string) {
  const { LIST_FIELDS } = await import("./sheet-layout");
  const since = new Date(Date.now() - 365 * 86400_000);
  const rows = await prisma.salesLedgerRow.findMany({
    where: { branchId, date: { gte: since } },
    select: Object.fromEntries([...LIST_FIELDS, "manager", "price", "date"].map((f) => [f, true])) as Record<string, true>,
    orderBy: { date: "asc" },
  });
  const options: Record<string, string[]> = {};
  for (const f of [...LIST_FIELDS, "manager"]) {
    const counts = new Map<string, number>();
    for (const r of rows as Array<Record<string, unknown>>) {
      const v = typeof r[f] === "string" ? (r[f] as string).trim() : "";
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    options[f] = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 400).map(([v]) => v);
  }
  const priceByProduct: Record<string, number> = {};
  for (const r of rows as Array<Record<string, unknown>>) {
    const p = typeof r.product === "string" ? r.product.trim() : "";
    if (p && r.price != null) priceByProduct[p] = Number(r.price);
  }
  return { options, priceByProduct };
}

/** Өздігінен есептелетін бағандар: Год/Мес — Датадан, Остаток = Продали за − (Чек1+Чек2+Чек3). */
export async function recomputeLedgerRow(id: string) {
  const r = await prisma.salesLedgerRow.findUniqueOrThrow({ where: { id } });
  const data: Record<string, unknown> = {};
  if (r.date) {
    const d = new Date(r.date.getTime() + 5 * 3600_000);
    data.year = d.getUTCFullYear();
    data.month = String(d.getUTCMonth() + 1);
  }
  if (r.soldFor != null) {
    const paid = [r.receipt1Amount, r.receipt2Amount, r.receipt3Amount].reduce((t, v) => t + Number(v ?? 0), 0);
    data.remainder = Math.max(0, Number(r.soldFor) - paid);
  }
  return prisma.salesLedgerRow.update({ where: { id }, data });
}
