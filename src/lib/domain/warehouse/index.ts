import { prisma, PermissionAction, type Prisma } from "@/lib/db";
import { assertPermission } from "@/lib/rbac";
import type { ActingUser } from "@/lib/domain/orders";

// §10 Warehouse (Қойма) модулі. Material каталогы Order модулінен келеді (§7 —
// конфигурацияда таңдалатын материалдар), currentStock/reservedStock өрістері
// схемада бұрыннан бар — жаңа кесте қажет болмады. Қозғалыс тарихы бөлек кесте
// орнына жалпы AuditLog арқылы жазылады (entityType="Material"), Order модулінің
// getOrderAuditLog() дәстүрін жалғастырады.

export interface MaterialFilters {
  category?: string;
  search?: string;
  lowStockOnly?: boolean;
}

function withAvailable<T extends { currentStock: unknown; reservedStock: unknown }>(m: T) {
  return { ...m, availableStock: Number(m.currentStock) - Number(m.reservedStock) };
}

export const LOW_STOCK_THRESHOLD = 10;

export async function listMaterials(user: ActingUser, filters: MaterialFilters = {}) {
  assertPermission(user, "materials", PermissionAction.VIEW);
  const where: Prisma.MaterialWhereInput = { isActive: true };
  if (filters.category) where.category = filters.category as never;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
      { supplier: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  const materials = await prisma.material.findMany({ where, orderBy: { name: "asc" } });
  const withStock = materials.map(withAvailable);
  return filters.lowStockOnly ? withStock.filter((m) => m.availableStock <= LOW_STOCK_THRESHOLD) : withStock;
}

export async function getMaterial(user: ActingUser, materialId: string) {
  assertPermission(user, "materials", PermissionAction.VIEW);
  const material = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
  return withAvailable(material);
}

export async function getMaterialMovementHistory(user: ActingUser, materialId: string) {
  assertPermission(user, "materials", PermissionAction.VIEW);
  return prisma.auditLog.findMany({
    where: { entityType: "Material", entityId: materialId },
    include: { actor: { include: { employee: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export interface CreateMaterialInput {
  sku: string;
  category: string;
  name: string;
  color?: string;
  type?: string;
  unit?: string;
  initialStock?: number;
  costPrice?: number;
  supplier?: string;
}

export async function createMaterial(user: ActingUser, input: CreateMaterialInput) {
  assertPermission(user, "materials", PermissionAction.CREATE);
  const material = await prisma.material.create({
    data: {
      sku: input.sku,
      category: input.category as never,
      name: input.name,
      color: input.color || null,
      type: input.type || null,
      unit: input.unit || "м²",
      currentStock: input.initialStock ?? 0,
      costPrice: input.costPrice ?? 0,
      supplier: input.supplier || null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "CREATE",
      entityType: "Material",
      entityId: material.id,
      newValue: { sku: material.sku, name: material.name, initialStock: input.initialStock ?? 0 },
    },
  });
  return material;
}

/** Қоймаға түсім (delta > 0) немесе есептен шығару/түзету (delta < 0). Теріс қалдыққа
 *  жол берілмейді — қате енгізуден немесе резервтен тыс тұтынудан сақтайды. */
export async function adjustStock(user: ActingUser, materialId: string, delta: number, reason: string) {
  assertPermission(user, "materials", PermissionAction.EDIT);
  if (delta === 0) throw new Error("Өзгеріс мөлшері 0 болмауы керек");

  const material = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
  const nextStock = Number(material.currentStock) + delta;
  if (nextStock < 0) {
    throw new Error(`Жеткіліксіз қалдық: қоймада ${material.currentStock} ${material.unit} бар, ${Math.abs(delta)} шығаруға болмайды`);
  }

  const updated = await prisma.material.update({ where: { id: materialId }, data: { currentStock: nextStock } });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: delta > 0 ? "STOCK_IN" : "STOCK_OUT",
      entityType: "Material",
      entityId: materialId,
      oldValue: { currentStock: Number(material.currentStock) },
      newValue: { currentStock: nextStock, delta, reason },
    },
  });
  return updated;
}

export async function updateMaterial(
  user: ActingUser,
  materialId: string,
  input: Partial<Pick<CreateMaterialInput, "name" | "color" | "type" | "unit" | "costPrice" | "supplier">>
) {
  assertPermission(user, "materials", PermissionAction.EDIT);
  return prisma.material.update({
    where: { id: materialId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color || null } : {}),
      ...(input.type !== undefined ? { type: input.type || null } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
      ...(input.supplier !== undefined ? { supplier: input.supplier || null } : {}),
    },
  });
}

export async function deactivateMaterial(user: ActingUser, materialId: string) {
  assertPermission(user, "materials", PermissionAction.EDIT);
  return prisma.material.update({ where: { id: materialId }, data: { isActive: false } });
}

/** §10 Warehouse KPI — жалпы қойма құны, аз қалғандар саны, категория бойынша бөлінісі. */
export async function getWarehouseKpis(user: ActingUser) {
  assertPermission(user, "materials", PermissionAction.VIEW);
  const materials = await prisma.material.findMany({ where: { isActive: true } });
  const withStock = materials.map(withAvailable);
  const totalValue = withStock.reduce((s, m) => s + Number(m.currentStock) * Number(m.costPrice), 0);
  const lowStockCount = withStock.filter((m) => m.availableStock <= LOW_STOCK_THRESHOLD).length;

  const byCategory = new Map<string, number>();
  for (const m of withStock) byCategory.set(m.category, (byCategory.get(m.category) ?? 0) + Number(m.currentStock) * Number(m.costPrice));

  return {
    totalMaterials: withStock.length,
    totalValue,
    lowStockCount,
    byCategory: [...byCategory.entries()].map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value),
  };
}
