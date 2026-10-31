import { prisma, PermissionAction, type Prisma } from "@/lib/db";
import { assertPermission, scopeWhere } from "@/lib/rbac";
import type { ActingUser } from "./types";

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
}

function dateRangeWhere(filters: AnalyticsFilters): Prisma.OrderWhereInput {
  if (!filters.dateFrom && !filters.dateTo) return {};
  return {
    createdAt: {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
    },
  };
}

/** §41 — Sату-менеджер бойынша KPI. */
export async function getManagerKpis(user: ActingUser, filters: AnalyticsFilters = {}) {
  const scope = assertPermission(user, "orders", PermissionAction.VIEW);
  const where: Prisma.OrderWhereInput = {
    ...scopeWhere(user, scope, { ownerField: "salesManagerId", branchField: "branchId" }),
    ...dateRangeWhere(filters),
  };
  const orders = await prisma.order.findMany({
    where,
    select: {
      status: true,
      finalAmount: true,
      discountAmount: true,
      paidAmount: true,
      customerId: true,
      salesManagerId: true,
      salesManager: { select: { fullName: true } },
      items: { select: { id: true } },
    },
  });

  const byManager = new Map<string, { name: string; orders: typeof orders }>();
  for (const o of orders) {
    if (!byManager.has(o.salesManagerId)) byManager.set(o.salesManagerId, { name: o.salesManager.fullName, orders: [] });
    byManager.get(o.salesManagerId)!.orders.push(o);
  }

  const rows = [...byManager.entries()].map(([managerId, { name, orders: mOrders }]) => {
    const created = mOrders.length;
    const confirmed = mOrders.filter((o) => !["DRAFT", "NEW", "CANCELLED"].includes(o.status)).length;
    const cancelled = mOrders.filter((o) => o.status === "CANCELLED").length;
    const returned = mOrders.filter((o) => o.status === "RETURNED").length;
    const revenue = mOrders.reduce((s, o) => s + Number(o.finalAmount), 0);
    const totalDiscount = mOrders.reduce((s, o) => s + Number(o.discountAmount), 0);
    const paidOrders = mOrders.filter((o) => Number(o.finalAmount) > 0 && Number(o.paidAmount) >= Number(o.finalAmount)).length;
    const unpaidBalance = mOrders.reduce((s, o) => s + Math.max(0, Number(o.finalAmount) - Number(o.paidAmount)), 0);
    const clientCounts = new Map<string, number>();
    for (const o of mOrders) clientCounts.set(o.customerId, (clientCounts.get(o.customerId) ?? 0) + 1);
    const repeatClients = [...clientCounts.values()].filter((c) => c > 1).length;

    return {
      managerId,
      name,
      created,
      confirmed,
      revenue,
      avgCheck: created > 0 ? revenue / created : 0,
      discountPct: revenue + totalDiscount > 0 ? (totalDiscount / (revenue + totalDiscount)) * 100 : 0,
      paidOrders,
      unpaidBalance,
      cancellationPct: created > 0 ? (cancelled / created) * 100 : 0,
      returnPct: created > 0 ? (returned / created) * 100 : 0,
      repeatClients,
      productsPerOrder: created > 0 ? mOrders.reduce((s, o) => s + o.items.length, 0) / created : 0,
      conversionPct: created > 0 ? (confirmed / created) * 100 : 0,
    };
  });

  return rows.sort((a, b) => b.revenue - a.revenue);
}

/** §42 — Өндіріс (цех) KPI. */
export async function getProductionKpis(user: ActingUser, filters: AnalyticsFilters = {}) {
  assertPermission(user, "orders", PermissionAction.VIEW);
  const where: Prisma.ProductionOrderWhereInput = {
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
          },
        }
      : {}),
  };
  const pos = await prisma.productionOrder.findMany({
    where,
    include: {
      qualityChecks: true,
      assignedWorker: { select: { fullName: true } },
      order: { select: { deadline: true, status: true } },
    },
  });

  const produced = pos.filter((p) => p.status === "READY").length;
  const durationsHours = pos
    .filter((p) => p.startedAt && p.finishedAt)
    .map((p) => (p.finishedAt!.getTime() - p.startedAt!.getTime()) / 3600000);
  const avgProductionHours = durationsHours.length > 0 ? durationsHours.reduce((s, d) => s + d, 0) / durationsHours.length : 0;
  const delayed = pos.filter(
    (p) => p.order.deadline && p.order.deadline < new Date() && !["COMPLETED", "CANCELLED"].includes(p.order.status)
  ).length;

  const allChecks = pos.flatMap((p) => p.qualityChecks);
  const defects = allChecks.filter((q) => q.result === "FAILED").length;
  const reworks = allChecks.filter((q) => q.result === "REWORK_REQUIRED").length;

  const byWorker = new Map<string, number>();
  for (const p of pos) {
    if (p.status === "READY" && p.assignedWorker) {
      byWorker.set(p.assignedWorker.fullName, (byWorker.get(p.assignedWorker.fullName) ?? 0) + 1);
    }
  }

  return {
    totalProductionOrders: pos.length,
    produced,
    avgProductionHours,
    delayed,
    defectRate: allChecks.length > 0 ? (defects / allChecks.length) * 100 : 0,
    reworkRate: allChecks.length > 0 ? (reworks / allChecks.length) * 100 : 0,
    workerProductivity: [...byWorker.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** §43 — Орнату (installation) KPI. Complaint % — жүйеде әлі complaints-модулі жоқ (N/A). */
export async function getInstallationKpis(user: ActingUser, filters: AnalyticsFilters = {}) {
  assertPermission(user, "orders", PermissionAction.VIEW);
  const where: Prisma.InstallationWhereInput = {
    ...(filters.dateFrom || filters.dateTo
      ? {
          date: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
          },
        }
      : {}),
  };
  const installs = await prisma.installation.findMany({ where, include: { order: { select: { deadline: true } } } });

  const byDay = new Map<string, number>();
  for (const i of installs) {
    if (!i.date) continue;
    const key = i.date.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const durationsHours = installs
    .filter((i) => i.startTime && i.finishTime)
    .map((i) => (i.finishTime!.getTime() - i.startTime!.getTime()) / 3600000);
  const reworks = installs.filter((i) => i.status === "REWORK").length;
  const completed = installs.filter((i) => i.status === "COMPLETED").length;
  const onTime = installs.filter(
    (i) => i.status === "COMPLETED" && (!i.order.deadline || (i.finishTime && i.finishTime <= i.order.deadline))
  ).length;

  return {
    total: installs.length,
    perDay: byDay.size > 0 ? installs.length / byDay.size : 0,
    avgHours: durationsHours.length > 0 ? durationsHours.reduce((s, d) => s + d, 0) / durationsHours.length : 0,
    reworkPct: installs.length > 0 ? (reworks / installs.length) * 100 : 0,
    onTimePct: completed > 0 ? (onTime / completed) * 100 : 0,
  };
}

/** §44 — Business Analytics: кіріс, top тауарлар/көлік модельдері, повторная покупка. */
export async function getBusinessAnalytics(user: ActingUser, filters: AnalyticsFilters = {}) {
  const scope = assertPermission(user, "orders", PermissionAction.VIEW);
  const where: Prisma.OrderWhereInput = {
    ...scopeWhere(user, scope, { ownerField: "salesManagerId", branchField: "branchId" }),
    ...dateRangeWhere(filters),
  };
  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { product: true } },
      vehicle: true,
      branch: true,
      salesManager: { select: { fullName: true } },
    },
  });

  const revenue = orders.reduce((s, o) => s + Number(o.finalAmount), 0);
  const totalDiscount = orders.reduce((s, o) => s + Number(o.discountAmount), 0);
  const outstandingDebt = orders.reduce((s, o) => s + Math.max(0, Number(o.finalAmount) - Number(o.paidAmount)), 0);

  function groupSum(keyFn: (o: (typeof orders)[number]) => string | null | undefined) {
    const m = new Map<string, number>();
    for (const o of orders) {
      const k = keyFn(o);
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + Number(o.finalAmount));
    }
    return [...m.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
  }

  const productQty = new Map<string, number>();
  for (const o of orders) for (const it of o.items) productQty.set(it.product.name, (productQty.get(it.product.name) ?? 0) + it.qty);
  const topProducts = [...productQty.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 10);

  const vehicleModelCount = new Map<string, number>();
  for (const o of orders) {
    if (!o.vehicle) continue;
    const key = `${o.vehicle.make} ${o.vehicle.model}`;
    vehicleModelCount.set(key, (vehicleModelCount.get(key) ?? 0) + 1);
  }
  const topVehicleModels = [...vehicleModelCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const custCounts = await prisma.order.groupBy({ by: ["customerId"], _count: { id: true } });
  const repeatCustomers = custCounts.filter((c) => c._count.id > 1).length;

  const activeOrders = orders.filter((o) => !["COMPLETED", "CANCELLED", "RETURNED"].includes(o.status));
  const delayedOrders = activeOrders.filter((o) => o.deadline && o.deadline < new Date());

  return {
    orderCount: orders.length,
    revenue,
    avgCheck: orders.length > 0 ? revenue / orders.length : 0,
    discountRate: revenue + totalDiscount > 0 ? (totalDiscount / (revenue + totalDiscount)) * 100 : 0,
    outstandingDebt,
    byDay: groupSum((o) => o.createdAt.toISOString().slice(0, 10)),
    byMonth: groupSum((o) => o.createdAt.toISOString().slice(0, 7)),
    byManager: groupSum((o) => o.salesManager.fullName),
    bySource: groupSum((o) => o.source),
    byBranch: groupSum((o) => o.branch?.name),
    byVehicleBrand: groupSum((o) => o.vehicle?.make),
    topProducts,
    topVehicleModels,
    repeatPurchaseRate: custCounts.length > 0 ? (repeatCustomers / custCounts.length) * 100 : 0,
    productionDelayPct: activeOrders.length > 0 ? (delayedOrders.length / activeOrders.length) * 100 : 0,
  };
}
