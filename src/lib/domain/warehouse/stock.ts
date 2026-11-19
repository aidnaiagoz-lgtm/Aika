import "server-only";
import { Prisma, type MaterialCategory } from "@prisma/client";
import { prisma, PermissionAction } from "@/lib/db";
import { assertPermission, can } from "@/lib/rbac";
import { canUseWorkshop } from "@/lib/access";
import type { ActingUser } from "@/lib/domain/orders";
import { daysLeft, moySkladCategory, parseLedgerMaterial, stockStatus, type MoySkladRow, type StockStatus } from "./stock-calc";

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
  photo: string | null;
}

/** Каталогтағы «нағыз» материалдар: кодпен келгендер немесе қойма арқылы қозғалғандар (бастапқы демо-жазбалар шықпасын). */
const visibleWhere: Prisma.MaterialWhereInput = { isActive: true, OR: [{ sourceLabel: { not: null } }, { movements: { some: {} } }] };

export async function stockOverview(user: ActingUser, opts: { filter?: StockFilter; category?: string; q?: string } = {}) {
  assertView(user);
  await syncCatalogFromLedger().catch((e) => console.error("[stock] catalog sync", e instanceof Error ? e.message : e));

  const materials = await prisma.material.findMany({
    where: visibleWhere,
    orderBy: [{ category: "asc" }, { sku: "asc" }],
    include: { photo: { select: { updatedAt: true } } },
  });
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
      photo: m.photo ? photoUrl(m.id, m.photo.updatedAt) : null,
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
    prisma.material.findMany({ where: visibleWhere, orderBy: [{ category: "asc" }, { sku: "asc" }], select: { id: true, sku: true, name: true, unit: true, category: true, currentStock: true, costPrice: true, photo: { select: { updatedAt: true } } } }),
    prisma.stockReceipt.findMany({ distinct: ["supplier"], select: { supplier: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    materials: materials.map((m) => ({
      id: m.id,
      sku: m.sku,
      name: m.name,
      unit: m.unit,
      category: m.category,
      stock: Number(m.currentStock),
      price: Number(m.costPrice),
      photo: m.photo ? photoUrl(m.id, m.photo.updatedAt) : null,
    })),
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
    include: {
      movements: { include: { material: { select: { sku: true, name: true, unit: true } } } },
      photos: { select: { id: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function materialDetail(user: ActingUser, id: string) {
  assertView(user);
  const m = await prisma.material.findUnique({ where: { id }, include: { photo: { select: { updatedAt: true, uploadedByName: true } } } });
  if (!m) return null;
  const moves = await prisma.stockMovement.findMany({ where: { materialId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  return {
    material: m,
    moves,
    photo: m.photo ? photoUrl(m.id, m.photo.updatedAt) : null,
    photoBy: m.photo ? { name: m.photo.uploadedByName, at: m.photo.updatedAt } : null,
  };
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

// ---------- МойСкладтан қалдық жүктеу (2026-11-18) ----------


/** Атаулар бір затты білдіре ме (қазақ/орыс әріптері, «жіп/ева» сөздері, жақшадағысы ескерілмейді). */
function sameThing(a: string, b: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/[қ]/g, "к").replace(/[ә]/g, "а").replace(/[іи]/g, "и").replace(/[ң]/g, "н").replace(/[ұү]/g, "у").replace(/[ө]/g, "о").replace(/[ғ]/g, "г")
      .replace(/(?<!\p{L})(жип|нитка|ева|лента|леска|кожа)(?!\p{L})/gu, " ")
      .split(/[^a-zа-яё0-9]+/i)
      .filter(Boolean);
  const A = new Set(norm(a)), B = new Set(norm(b));
  if (!A.size || !B.size) return true;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.min(A.size, B.size) >= 0.5;
}

/** Бағасы сенімді санаттар: жіп пен ұсақ-түйектің МойСкладтағы өзіндік құны шатасқан (бобина/метр) — алынбайды. */
const PRICED: MaterialCategory[] = ["LEATHER", "EDGING", "EVA", "FISHING_LINE"];

export interface MoySkladPreviewItem {
  code: string;
  msName: string;
  siteName: string | null;
  category: MaterialCategory;
  unit: string;
  siteUnit: string | null;
  oldStock: number;
  newStock: number;
  msStock: number;
  price: number | null;
  nameDiffers: boolean;
}

function cleanRows(rows: MoySkladRow[]): MoySkladRow[] {
  if (!Array.isArray(rows) || rows.length > 3000) throw new StockError("Файл тым үлкен немесе бос");
  const seen = new Set<string>();
  const out: MoySkladRow[] = [];
  for (const r of rows) {
    const code = String(r?.code ?? "").trim().slice(0, 20);
    const name = String(r?.name ?? "").trim().slice(0, 120);
    if (!code || !name || !moySkladCategory(String(r.group ?? "")) || seen.has(code)) continue;
    if (!Number.isFinite(r.stock) || !Number.isFinite(r.cost)) continue;
    seen.add(code);
    out.push({ group: String(r.group).slice(0, 80), code, name, unit: String(r.unit || "дана").slice(0, 20), stock: r.stock, cost: r.cost });
  }
  return out;
}

export async function previewMoySklad(user: ActingUser, rawRows: MoySkladRow[]) {
  assertEdit(user);
  const rows = cleanRows(rawRows);
  const existing = await prisma.material.findMany({ where: { sku: { in: rows.map((r) => r.code) } } });
  const by = new Map(existing.map((m) => [m.sku, m]));
  const items: MoySkladPreviewItem[] = rows.map((r) => {
    const m = by.get(r.code);
    const category = moySkladCategory(r.group, r.unit)!;
    return {
      code: r.code,
      msName: r.name,
      siteName: m?.name ?? null,
      category,
      unit: r.unit,
      siteUnit: m?.unit ?? null,
      oldStock: m ? Number(m.currentStock) : 0,
      newStock: Math.max(0, Math.round(r.stock * 100) / 100),
      msStock: r.stock,
      price: PRICED.includes(category) && r.cost > 0 ? Math.round(r.cost * 100) / 100 : null,
      nameDiffers: !!m && !sameThing(m.name, r.name),
    };
  });
  const leather = items.filter((i) => i.category === "LEATHER" && i.unit === "м").reduce((s, i) => s + i.newStock, 0);
  const value = items.reduce((s, i) => s + i.newStock * (i.price ?? 0), 0);
  return {
    items,
    summary: {
      total: items.length,
      matched: items.filter((i) => i.siteName).length,
      created: items.filter((i) => !i.siteName).length,
      negative: items.filter((i) => i.msStock < 0).length,
      nameDiffers: items.filter((i) => i.nameDiffers).length,
      unitChanged: items.filter((i) => i.siteUnit && i.siteUnit !== i.unit).length,
      leather: Math.round(leather * 10) / 10,
      value: Math.round(value),
    },
  };
}

/** Қалдықты МойСкладтағыға теңестіреді: әр айырма «Санау» қозғалысы болып жазылады; жоқ материалдар қосылады. Ештеңе өшірілмейді. */
export async function applyMoySklad(user: U, rawRows: MoySkladRow[]) {
  const { items } = await previewMoySklad(user, rawRows);
  if (items.length === 0) throw new StockError("Жүктейтін цех материалы табылмады");
  const who = user.employee?.id
    ? (await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } }))?.fullName ?? null
    : null;
  const note = "МойСклад: қалдық теңестірілді";
  let changed = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const i of items) {
        const m = await tx.material.findUnique({ where: { sku: i.code } });
        const price = i.price != null ? new Prisma.Decimal(i.price) : undefined;
        const target = new Prisma.Decimal(i.newStock);
        const mat = m
          ? await tx.material.update({
              where: { id: m.id },
              data: {
                unit: i.unit,
                currentStock: target,
                isActive: true,
                ...(price ? { costPrice: price } : {}),
                // МойСкладтан қосылғанның санаты МойСклад бойынша жаңарады; Продажиден келгенге тимейді
                ...(m.sourceLabel?.startsWith("МойСклад:") ? { category: i.category, name: i.msName } : {}),
              },
            })
          : await tx.material.create({
              data: { sku: i.code, name: i.msName, category: i.category, unit: i.unit, currentStock: target, costPrice: price ?? 0, sourceLabel: `МойСклад: ${i.msName}` },
            });
        const diff = i.newStock - (m ? Number(m.currentStock) : 0);
        if (Math.abs(diff) >= 0.005) {
          changed++;
          await tx.stockMovement.create({
            data: { materialId: mat.id, kind: "COUNT", qty: new Prisma.Decimal(Math.round(diff * 100) / 100), stockAfter: target, unitPrice: price ?? null, note, createdById: user.id, createdByName: who },
          });
        }
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "STOCK_IMPORT", entityType: "Material", entityId: "moysklad", newValue: { items: items.length, changed } },
  });
  return { items: items.length, changed };
}

// ---------- Материал фотосы (2026-11-19) ----------

export const photoUrl = (materialId: string, updatedAt: Date) => `/api/material-photo/${materialId}?v=${updatedAt.getTime()}`;

const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX = 600 * 1024;

export interface PhotoFile {
  name: string;
  mime: string;
  data: Buffer;
}

/** Фотоны кім қосқаны (материал бетінде көрсетіледі). */
async function uploader(user: ActingUser) {
  const name = user.employee?.id ? (await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } }))?.fullName ?? null : null;
  return { uploadedById: user.id, uploadedByName: name };
}

function checkPhoto(f: PhotoFile) {
  if (!PHOTO_MIME.includes(f.mime)) throw new StockError(`«${f.name}» — тек JPG, PNG немесе WEBP сурет`);
  if (f.data.length > PHOTO_MAX) throw new StockError(`«${f.name}» тым үлкен (600 КБ-тан аз болсын)`);
}

/** Бірнеше фото: файл атауы — материал коды («4050.jpg»). Табылмаған кодтар қайтарылады. */
export async function saveMaterialPhotos(user: ActingUser, files: PhotoFile[]) {
  assertEdit(user);
  if (files.length > 20) throw new StockError("Бір ретте 20 фотодан көп емес");
  const saved: string[] = [];
  const unknown: string[] = [];
  const by = await uploader(user);
  for (const f of files) {
    checkPhoto(f);
    const code = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/-\d+$/, "").trim();
    const m = code ? await prisma.material.findUnique({ where: { sku: code }, select: { id: true } }) : null;
    if (!m) {
      unknown.push(f.name);
      continue;
    }
    const data = new Uint8Array(f.data);
    await prisma.materialPhoto.upsert({ where: { materialId: m.id }, update: { mime: f.mime, data, ...by }, create: { materialId: m.id, mime: f.mime, data, ...by } });
    saved.push(code);
  }
  return { saved, unknown };
}

/** Бір материалдың фотосын ауыстыру (материал бетінен). */
export async function setMaterialPhoto(user: ActingUser, materialId: string, f: PhotoFile) {
  assertEdit(user);
  checkPhoto(f);
  const data = new Uint8Array(f.data);
  const by = await uploader(user);
  await prisma.materialPhoto.upsert({ where: { materialId }, update: { mime: f.mime, data, ...by }, create: { materialId, mime: f.mime, data, ...by } });
}

/**
 * Цех (Бекзат) заказ бетінен: тек фотосы ЖОҚ материалға фото қосады. Бар фотоны ауыстыру — қойма/CEO (CEO шешімі, 2026-11-19).
 */
export async function addMissingMaterialPhoto(user: ActingUser, materialId: string, f: PhotoFile) {
  const full = can(user, "materials", PermissionAction.EDIT);
  if (!full && !canUseWorkshop(user)) throw new StockError("Фото қосуға рұқсат жоқ");
  checkPhoto(f);
  const exists = await prisma.materialPhoto.findUnique({ where: { materialId }, select: { id: true } });
  if (exists && !full) throw new StockError("Бұл материалдың фотосы бар — ауыстыруды CEO жасайды");
  const m = await prisma.material.findUnique({ where: { id: materialId }, select: { id: true } });
  if (!m) throw new StockError("Материал табылмады");
  const data = new Uint8Array(f.data);
  const by = await uploader(user);
  await prisma.materialPhoto.upsert({ where: { materialId }, update: { mime: f.mime, data, ...by }, create: { materialId, mime: f.mime, data, ...by } });
}

/** Код → материал id (фотосы барлар мен жоқтарды қоса). */
export async function materialIdsByCode(codes: string[]) {
  const list = [...new Set(codes.filter(Boolean))];
  if (!list.length) return new Map<string, string>();
  const rows = await prisma.material.findMany({ where: { sku: { in: list } }, select: { sku: true, id: true } });
  return new Map(rows.map((r) => [r.sku, r.id]));
}

/** Код → фото сілтемесі (цех беті, тізімдер үшін). */
export async function photoUrlsByCode(codes: string[]) {
  const list = [...new Set(codes.filter(Boolean))];
  if (!list.length) return new Map<string, string>();
  const rows = await prisma.material.findMany({ where: { sku: { in: list }, photo: { isNot: null } }, select: { sku: true, id: true, photo: { select: { updatedAt: true } } } });
  return new Map(rows.map((r) => [r.sku, photoUrl(r.id, r.photo!.updatedAt)]));
}

// ---------- Накладнаның фотосы (2026-11-19) ----------

const RECEIPT_PHOTO_MAX = 900 * 1024;

/** Кіріске накладнаның фотосын тіркеу (браузер алдын ала кішірейтеді). Бір кіріске — 10 фотоға дейін. */
export async function addReceiptPhoto(user: ActingUser, receiptId: string, f: PhotoFile) {
  assertEdit(user);
  if (!PHOTO_MIME.includes(f.mime)) throw new StockError(`«${f.name}» — тек JPG, PNG немесе WEBP сурет`);
  if (f.data.length > RECEIPT_PHOTO_MAX) throw new StockError(`«${f.name}» тым үлкен`);
  const receipt = await prisma.stockReceipt.findUnique({ where: { id: receiptId }, select: { id: true, _count: { select: { photos: true } } } });
  if (!receipt) throw new StockError("Кіріс табылмады");
  if (receipt._count.photos >= 10) throw new StockError("Бір кіріске 10 фотодан көп емес");
  await prisma.stockReceiptPhoto.create({ data: { receiptId, mime: f.mime, data: new Uint8Array(f.data) } });
}
