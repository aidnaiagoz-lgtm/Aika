import { prisma, PermissionAction, type Prisma } from "@/lib/db";
import { assertPermission } from "@/lib/rbac";
import type { ActingUser } from "@/lib/domain/orders";

// §42 — Production department queue. Схема (ProductionOrder/QualityControl) Order
// модулінен келеді (§15), бұл жерде тек цех үшін жинақталған "менің кезегім" көрінісі
// және стадия ауыстыру логикасы қосылады — жаңа кесте қажет емес.

const STAGE_ORDER = ["NEW", "QUEUED", "CUTTING", "ASSEMBLY", "EDGING", "LOGO", "QUALITY_CHECK", "READY"] as const;

export interface ProductionQueueFilters {
  status?: string;
  workshop?: string;
  assignedWorkerId?: string;
  priority?: string;
  onlyMine?: boolean;
}

export async function listProductionQueue(user: ActingUser, filters: ProductionQueueFilters = {}) {
  assertPermission(user, "orders", PermissionAction.VIEW);
  const where: Prisma.ProductionOrderWhereInput = {};
  if (filters.status) where.status = filters.status as never;
  if (filters.workshop) where.workshop = filters.workshop;
  if (filters.priority) where.priority = filters.priority as never;
  if (filters.onlyMine && user.employee) where.assignedWorkerId = user.employee.id;
  else if (filters.assignedWorkerId) where.assignedWorkerId = filters.assignedWorkerId;

  const pos = await prisma.productionOrder.findMany({
    where,
    include: {
      order: { select: { id: true, orderNumber: true, deadline: true, priority: true, customer: { select: { fullName: true } } } },
      assignedWorker: true,
      qualityChecks: { orderBy: { date: "desc" }, take: 1 },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  // ProductionOrder.orderItemId — scalar FK, schema-да OrderItem-ге қатысты навигация relation
  // жоқ, сондықтан бума JOIN орнына бөлек, бір рет қана сұрау (N+1 болдырмау үшін).
  const itemIds = pos.map((p) => p.orderItemId).filter((id): id is string => Boolean(id));
  const items = itemIds.length > 0 ? await prisma.orderItem.findMany({ where: { id: { in: itemIds } }, include: { product: true } }) : [];
  const itemById = new Map(items.map((i) => [i.id, i]));

  return pos.map((po) => ({ ...po, orderItem: po.orderItemId ? (itemById.get(po.orderItemId) ?? null) : null }));
}

export async function listWorkshops(): Promise<string[]> {
  const rows = await prisma.productionOrder.findMany({
    where: { workshop: { not: null } },
    select: { workshop: true },
    distinct: ["workshop"],
  });
  return rows.map((r) => r.workshop!).filter(Boolean).sort();
}

export async function listProductionWorkers() {
  return prisma.employee.findMany({
    where: { user: { userRoles: { some: { role: { name: { in: ["PRODUCTION_MANAGER", "PRODUCTION_EMPLOYEE"] } } } } } },
    orderBy: { fullName: "asc" },
  });
}

export async function assignProductionWorker(user: ActingUser, productionOrderId: string, workerId: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  return prisma.productionOrder.update({ where: { id: productionOrderId }, data: { assignedWorkerId: workerId || null } });
}

export async function setWorkshop(user: ActingUser, productionOrderId: string, workshop: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  return prisma.productionOrder.update({ where: { id: productionOrderId }, data: { workshop: workshop || null } });
}

/** Стадия ауыстыру (NEW→QUEUED→CUTTING→...→QUALITY_CHECK). READY-ге QC PASSED арқылы
 *  ғана жетеді (§15 — recordQualityCheck), сондықтан READY бұл жерден қолжетімсіз. */
export async function advanceProductionStage(user: ActingUser, productionOrderId: string, toStatus: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  if (toStatus === "READY") throw new Error("READY статусына тек QC (Quality Control) арқылы өтуге болады");

  const po = await prisma.productionOrder.findUniqueOrThrow({ where: { id: productionOrderId } });
  const data: Prisma.ProductionOrderUpdateInput = { status: toStatus as never };
  if (!po.startedAt && STAGE_ORDER.indexOf(toStatus as (typeof STAGE_ORDER)[number]) > STAGE_ORDER.indexOf("NEW")) {
    data.startedAt = new Date();
  }
  return prisma.productionOrder.update({ where: { id: productionOrderId }, data });
}
