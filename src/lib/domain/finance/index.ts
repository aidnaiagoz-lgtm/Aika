import { prisma, PermissionAction, type Prisma } from "@/lib/db";
import { assertPermission } from "@/lib/rbac";
import type { ActingUser } from "@/lib/domain/orders";

// §10 Finance (Қаржы) негіздері. Бөлек кесте керек болмады — Payment моделі Order
// модулінен келеді (§13), бұл жерде тек қаржы бөлімі үшін жинақталған есеп-беру
// (reconciliation) көрінісі қосылады. RBAC жаңа resource қажет етпейді: FINANCE/
// ACCOUNTANT рөлдері "orders" ресурсына VIEW ALL алып қойған (Payment — Order-дың
// ішкі кестесі), тек оқу үшін жеткілікті.

export interface PaymentFilters {
  method?: string;
  cashbox?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

function dateRangeWhere(filters: PaymentFilters): Prisma.PaymentWhereInput {
  if (!filters.dateFrom && !filters.dateTo) return {};
  return {
    paidAt: {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
    },
  };
}

export async function listPayments(user: ActingUser, filters: PaymentFilters = {}) {
  assertPermission(user, "orders", PermissionAction.VIEW);
  const where: Prisma.PaymentWhereInput = { ...dateRangeWhere(filters) };
  if (filters.method) where.method = filters.method as never;
  if (filters.cashbox) where.cashbox = filters.cashbox;
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.search) {
    where.order = {
      OR: [
        { orderNumber: { contains: filters.search, mode: "insensitive" } },
        { customer: { fullName: { contains: filters.search, mode: "insensitive" } } },
      ],
    };
  }

  return prisma.payment.findMany({
    where,
    include: { order: { select: { orderNumber: true, customer: { select: { fullName: true } } } }, employee: true },
    orderBy: { paidAt: "desc" },
  });
}

export async function listCashboxes(): Promise<string[]> {
  const rows = await prisma.payment.findMany({ where: { cashbox: { not: null } }, select: { cashbox: true }, distinct: ["cashbox"] });
  return rows.map((r) => r.cashbox!).filter(Boolean).sort();
}

export async function listCollectingEmployees() {
  const rows = await prisma.payment.findMany({
    where: { employeeId: { not: null } },
    select: { employee: true },
    distinct: ["employeeId"],
  });
  return rows.map((r) => r.employee!).filter(Boolean).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** §10 Finance KPI — жиналған сома, әдіс/кассa бойынша бөлінісі, жалпы борыш. */
export async function getFinanceKpis(user: ActingUser, filters: PaymentFilters = {}) {
  assertPermission(user, "orders", PermissionAction.VIEW);
  const where: Prisma.PaymentWhereInput = { ...dateRangeWhere(filters) };
  const payments = await prisma.payment.findMany({ where });

  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const avgPayment = payments.length > 0 ? totalCollected / payments.length : 0;

  const byMethod = new Map<string, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));

  const byCashbox = new Map<string, number>();
  for (const p of payments) {
    const key = p.cashbox ?? "Белгісіз";
    byCashbox.set(key, (byCashbox.get(key) ?? 0) + Number(p.amount));
  }

  const activeOrders = await prisma.order.findMany({
    where: { status: { notIn: ["CANCELLED", "RETURNED", "DRAFT"] } },
    select: { finalAmount: true, paidAmount: true },
  });
  const outstandingDebt = activeOrders.reduce((s, o) => s + Math.max(0, Number(o.finalAmount) - Number(o.paidAmount)), 0);

  return {
    paymentCount: payments.length,
    totalCollected,
    avgPayment,
    outstandingDebt,
    byMethod: [...byMethod.entries()].map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value),
    byCashbox: [...byCashbox.entries()].map(([cashbox, value]) => ({ cashbox, value })).sort((a, b) => b.value - a.value),
  };
}
