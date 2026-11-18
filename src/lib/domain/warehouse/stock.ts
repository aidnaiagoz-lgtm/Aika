import "server-only";
import { Prisma, type MaterialCategory } from "@prisma/client";
import { prisma, PermissionAction } from "@/lib/db";
import { assertPermission, can } from "@/lib/rbac";
import type { ActingUser } from "@/lib/domain/orders";
import { daysLeft, parseLedgerMaterial, stockStatus, type StockStatus } from "./stock-calc";

/**
 * Қойма, 1-кезең (CEO, 2026-11-18): каталог (Google/тапсырыс формасындағы кодтар), қалдық, кіріс (накладная), қозғалыс тарихы.
 * Қалдық — Material.currentStock; әр өзгеріс StockMovement болып жазылады. Цехтан өзі шегеру — 2-кезеңде.
 */

export class StockError extends Error {}

type U = ActingUser & { employee?: { id: string; departmentId: string | null; branchId: string | null; fullName?: string | null } | null };

export const canUseWarehouse = (user: ActingUser) => can(user, "materials", PermissionAction.VIEW);
const assertView = (user: ActingUser) => assertPermission(user, "materials", PermissionAction.VIEW);
const assertEdit = (user: ActingUser) => assertPermission(user, "materials", PermissionAction.EDIT);

const LEDGER_FIELDS = ["leatherType", "leatherThread", "leatherPiping", "matType", "matThread", "matPiping"] as const;

/** Тапсырыс формасындағы (Продажи) материал атауларынан каталогты толтырады: жоқ кодтар қосылады, бар — өзгермейді. */
export async function syncCatalogFromLedger(): Promise<number> {
  const found = new Map<string, ReturnType<typeof parseLedgerMaterial> & object>();
  for (const f of LEDGER_FIELDS) {
    const rows = await prisma.salesLedgerRow.findMany({ distinct: [f], select: { [f]: true } as Record<typeof f, true> });
    for (const r of rows) {
      const item = parseLedgerMaterial((r as Record<string, string | null>)[f]);
      if (item && !found.has(item.sku)) found.set(item.sku, item);
    }
  }
  if (found.size === 0) return 0;
  const existingRows = await prisma.material.findMany({ where: { sku: { in: [...found.keys()] } }, select: { id: true, sku: true, name: true, sourceLabel: true } });
  const existing = new Set(existingRows.map((m) => m.sku));
  // Каталогтан жасалған атау ережесі өзгерсе — сол жолдардың атауы жаңарады (қолмен жасалғандарға тимейді)
  for (const e of existingRows) {
    const item = found.get(e.sku);
    if (item && e.sourceLabel === item.sourceLabel && e.name !== item.name) await prisma.material.update({ where: { id: e.id }, data: { name: item.name } });
  }
  const fresh = [...found.values()].filter((m) => !existing.has(m.sku));
  if (fresh.length) {
    await prisma.material.createMany({
      data: fresh.map((m) => ({ sku: m.sku, name: m.name, category: m.category, unit: m.unit, sourceLabel: m.sourceLabel })),
      skipDuplicates: true,
    });
  }
  return fresh.length;
}

export type StockFilter = "all" | "low" | "out";

export interface StockRow {
  id: string;
  sku: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  stock: number;
  min: number | null;
  price: number;
  status: StockStatus;
  days: number | null;
  last: { at: string; qty: number; kind: string; orderNo: string | null } | null;
}

/** Каталогтағы «нағыз» материалдар: кодпен келгендер немесе қалдығы барлар (демо-жазбалар шықпасын). */
const visibleWhere: Prisma.MaterialWhereInput = { isActive: true, OR: [{ sourceLabel: { not: null } }, { currentStock: { gt: 0 } }] };

export async function stockOverview(user: ActingUser, opts: { filter?: StockFilter; category?: string; q?: string } = {}) {
  assertView(user);
  await syncCatalogFromLedger().catch((e) => console.error("[stock] catalog sync", e instanceof Error ? e.message : e));

  const materials = await prisma.material.findMany({ where: visibleWhere, orderBy: [{ category: "asc" }, { sku: "asc" }] });
  const ids = materials.map((m) => m.id);
  const since = new Date(Date.now() - 30 * 86400_000);
  const [lastMoves, out30, moved] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { materialId: { in: ids } },
      orderBy: { createdAt: "desc" },
      distinct: ["materialId"],
      select: { materialId: true, createdAt: true, qty: true, kind: true, orderNo: true },
    }),
    prisma.stockMovement.groupBy({ by: ["materialId"], where: { materialId: { in: ids }, qty: { lt: 0 }, kind: "OUT", createdAt: { gte: since } }, _sum: { qty: true } }),
    prisma.stockMovement.groupBy({ by: ["materialId"], where: { materialId: { in: ids } }, _count: { _all: true } }),
  ]);
  const lastBy = new Map(lastMoves.map((m) => [m.materialId, m]));
  const outBy = new Map(out30.map((m) => [m.materialId, Math.abs(Number(m._sum.qty ?? 0))]));
  const movedSet = new Set(moved.map((m) => m.materialId));

  const all: StockRow[] = materials.map((m) => {
    const stock = Number(m.currentStock);
    const min = m.minStock == null ? null : Number(m.minStock);
    const l = lastBy.get(m.id);
    return {
      id: m.id,
      sku: m.sku,
      name: m.name,
      category: m.category,
      unit: m.unit,
      stock,
      min,
      price: Number(m.costPrice),
      status: stockStatus(stock, min, movedSet.has(m.id)),
      days: daysLeft(stock, outBy.get(m.id) ?? 0),
      last: l ? { at: l.createdAt.toISOString(), qty: Number(l.qty), kind: l.kind, orderNo: l.orderNo } : null,
    };
  });

  const kpi = {
    value: all.reduce((s, r) => s + Math.max(0, r.stock) * r.price, 0),
    leather: all.filter((r) => r.category === "LEATHER").reduce((s, r) => s + Math.max(0, r.stock), 0),
    low: all.filter((r) => r.status === "low").length,
    out: all.filter((r) => r.status === "out").length,
  };
  const byCategory = new Map<MaterialCategory, number>();
  for (const r of all) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);

  const q = (opts.q ?? "").trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      (!opts.filter || opts.filter === "all" || r.status === opts.filter) &&
      (!opts.category || r.category === opts.category) &&
      (!q || r.sku.includes(q) || r.name.toLowerCase().includes(q)),
  );
  // Қалдығы бар/қозғалғандар — жоғарыда, «кіріс болмағандар» — төменде
  rows.sort((a, b) => Number(a.status === "none") - Number(b.status === "none"));
  // Аз қалды/бітті — алдымен «ең аз күнге жететін»
  if (opts.filter === "low" || opts.filter === "out") rows.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999) || a.stock - b.stock);

  return { rows, total: all.length, kpi, byCategory: [...byCategory.entries()] };
}

/** Кіріс формасына: таңдауға болатын материалдар (код · атауы) және бұрынғы жеткізушілер. */
export async function receiptFormData(user: ActingUser) {
  assertEdit(user);
  await syncCatalogFromLedger().catch(() => 0);
  const [materials, suppliers] = await Promise.all([
    prisma.material.findMany({ where: visibleWhere, orderBy: [{ category: "asc" }, { sku: "asc" }], select: { id: true, sku: true, name: true, unit: true, category: true, currentStock: true, costPrice: true } }),
    prisma.stockReceipt.findMany({ distinct: ["supplier"], select: { supplier: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    materials: materials.map((m) => ({ id: m.id, sku: m.sku, name: m.name, unit: m.unit, category: m.category, stock: Number(m.currentStock), price: Number(m.costPrice) })),
    suppliers: suppliers.map((s) => s.supplier),
  };
}

export interface ReceiptInput {
  supplier: string;
  date: string; // YYYY-MM-DD
  docNo?: string;
  paymentMethod?: string;
  note?: string;
  lines: Array<{ materialId: string; qty: number; price: number | null }>;
}

const clean = (s: string | null | undefined, max = 120) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, max) : null;
};

/** Кіріс: накладная + әр жол қалдыққа қосылады; соңғы баға материалдың бағасы болады. */
export async function createReceipt(user: U, input: ReceiptInput) {
  assertEdit(user);
  const supplier = clean(input.supplier);
  if (!supplier) throw new StockError("Жеткізушіні жазыңыз");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new StockError("Күнін таңдаңыз");
  const lines = input.lines.filter((l) => l.materialId && l.qty);
  if (lines.length === 0) throw new StockError("Кем дегенде бір материал қосыңыз");
  for (const l of lines) {
    if (!(l.qty > 0 && l.qty <= 100000)) throw new StockError("Саны 0-ден үлкен болуы керек");
    if (l.price != null && !(l.price >= 0 && l.price <= 10_000_000)) throw new StockError("Баға дұрыс емес");
  }
  if (new Set(lines.map((l) => l.materialId)).size !== lines.length) throw new StockError("Бір материал екі рет жазылған — біріктіріңіз");
  const who = user.employee?.id
    ? (await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } }))?.fullName ?? null
    : null;
  const total = lines.reduce((s, l) => s + l.qty * (l.price ?? 0), 0);

  return prisma.$transaction(async (tx) => {
    const receipt = await tx.stockReceipt.create({
      data: {
        supplier,
        docNo: clean(input.docNo, 60),
        date: new Date(`${input.date}T12:00:00+05:00`),
        paymentMethod: clean(input.paymentMethod, 40),
        note: clean(input.note, 300),
        total: new Prisma.Decimal(Math.round(total * 100) / 100),
        createdById: user.id,
        createdByName: who,
      },
    });
    for (const l of lines) {
      const m = await tx.material.update({
        where: { id: l.materialId },
        data: {
          currentStock: { increment: new Prisma.Decimal(l.qty) },
          ...(l.price != null && l.price > 0 ? { costPrice: new Prisma.Decimal(l.price) } : {}),
          supplier,
        },
      });
      await tx.stockMovement.create({
        data: {
          materialId: l.materialId,
          kind: "IN",
          qty: new Prisma.Decimal(l.qty),
          stockAfter: m.currentStock,
          unitPrice: l.price == null ? null : new Prisma.Decimal(l.price),
          receiptId: receipt.id,
          note: supplier,
          createdById: user.id,
          createdByName: who,
        },
      });
    }
    return receipt;
  });
}

export async function listReceipts(user: ActingUser) {
  assertView(user);
  return prisma.stockReceipt.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { movements: { include: { material: { select: { sku: true, name: true, unit: true } } } } },
  });
}

export async function materialDetail(user: ActingUser, id: string) {
  assertView(user);
  const m = await prisma.material.findUnique({ where: { id } });
  if (!m) return null;
  const moves = await prisma.stockMovement.findMany({ where: { materialId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  return { material: m, moves };
}

/** Минимум қалдық (одан төмен түссе — «Аз қалды») және 1 бірліктің бағасы. */
export async function updateMaterialStockSettings(user: ActingUser, id: string, patch: { minStock?: number | null; price?: number | null }) {
  assertEdit(user);
  const data: Prisma.MaterialUpdateInput = {};
  if ("minStock" in patch) {
    if (patch.minStock != null && !(patch.minStock >= 0 && patch.minStock <= 100000)) throw new StockError("Минимум дұрыс емес");
    data.minStock = patch.minStock == null ? null : new Prisma.Decimal(patch.minStock);
  }
  if ("price" in patch) {
    if (patch.price != null && !(patch.price >= 0 && patch.price <= 10_000_000)) throw new StockError("Баға дұрыс емес");
    data.costPrice = new Prisma.Decimal(patch.price ?? 0);
  }
  return prisma.material.update({ where: { id }, data });
}
