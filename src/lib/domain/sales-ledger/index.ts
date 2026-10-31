import { prisma, PermissionAction } from "@/lib/db";
import { assertPermission, scopeWhere } from "@/lib/rbac";
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

export async function previewNextNo(branchId: string): Promise<number> {
  return nextNo(branchId);
}

export async function listLedgerRows(user: ActingUser, branchId: string) {
  const scope = assertPermission(user, "deals", PermissionAction.VIEW);
  const where = {
    branchId,
    ...scopeWhere(user, scope, { ownerField: "createdById" }),
  };
  return prisma.salesLedgerRow.findMany({
    where,
    include: { createdBy: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function getLedgerRow(user: ActingUser, id: string) {
  assertPermission(user, "deals", PermissionAction.VIEW);
  return prisma.salesLedgerRow.findUniqueOrThrow({ where: { id } });
}

export async function createLedgerRow(user: ActingUser, branchId: string, input: LedgerRowInput) {
  assertPermission(user, "deals", PermissionAction.CREATE);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы жазба қоса алады");

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

  const row = await prisma.salesLedgerRow.update({ where: { id }, data: toPrismaData(input) });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "EDIT", entityType: "SalesLedgerRow", entityId: id, newValue: input as object },
  });

  return row;
}

export async function deleteLedgerRow(user: ActingUser, id: string) {
  const scope = assertPermission(user, "deals", PermissionAction.DELETE);
  const existing = await prisma.salesLedgerRow.findUniqueOrThrow({ where: { id } });
  if (scope === "OWN" && existing.createdById !== user.employee?.id) {
    throw new Error("Тек өз жазбаңызды өшіре аласыз");
  }

  await prisma.salesLedgerRow.delete({ where: { id } });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "DELETE", entityType: "SalesLedgerRow", entityId: id },
  });
}
