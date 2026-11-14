import "server-only";
import { createHash } from "node:crypto";
import { prisma, PermissionAction } from "@/lib/db";
import { assertPermission } from "@/lib/rbac";
import { createLedgerRow, recomputeLedgerRow } from "@/lib/domain/sales-ledger";
import { normalizePhone } from "@/lib/domain/sales-ledger/normalize/phone";
import { parsePayment } from "@/lib/domain/sales-ledger/normalize/payment";
import { canonicalMake } from "@/lib/domain/sales-ledger/normalize/car-make";
import { canonicalModel } from "@/lib/domain/sales-ledger/normalize/car-model";
import type { ActingUser } from "./types";
import { generateOrderNumber } from "./index";
import { allocateReceipts, itemMoney, parseMoney, paymentEnum, type PaymentIn } from "./sales-order-calc";

/**
 * Сатылым заказы — Google «продажи» кестесінің орнына (2026-11).
 * Менеджер бір форманы толтырады → Order (Заказдар бөлімі) + әр тауарға бір Продажи жолы жасалады.
 * Продажи жолы арқылы рейтинг, касса, цех (Бекзат), лидтер, Google кестеге көшіру бұрынғыдай жұмыс істейді.
 */

export interface SalesOrderItemIn {
  product: string;
  price: number | null;
  soldFor: number | null;
  leatherType?: string;
  leatherThread?: string;
  leatherPiping?: string;
  matType?: string;
  matThread?: string;
  matPiping?: string;
  pocketsPairs?: number | null;
  pocketsLogo?: boolean;
  workshop: boolean;
  /** Қай көлікке (cars ішіндегі индекс, 0-ден). Бір клиент 2–3 көлікке алуы мүмкін (CEO, 2026-11-14). */
  carIndex?: number;
}

export interface SalesOrderCarIn {
  make?: string;
  model?: string;
  year?: number | null;
  generation?: string;
  originCountry?: string;
}

export interface SalesOrderIn {
  customer: { phone: string; name: string; city?: string };
  channel?: string;
  car: SalesOrderCarIn;
  /** Бірнеше көлік (болса). Жоқ болса — тек `car`. */
  cars?: SalesOrderCarIn[];
  items: SalesOrderItemIn[];
  payments: PaymentIn[];
  pickupMethod?: string;
  managerBonus?: number | null;
  certificateNo?: string;
  comment?: string;
}

export class SalesOrderError extends Error {}

const clean = (v: unknown, max = 200) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : undefined;
};
const money = parseMoney;
const almatyToday = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

/** Google кестедегі тауар атауы → Product (каталог). Жоқ болса жасалады. */
async function ensureProduct(name: string, price: number | null) {
  const sku = "SHEET-" + createHash("sha1").update(name.toLowerCase()).digest("hex").slice(0, 10).toUpperCase();
  return prisma.product.upsert({
    where: { sku },
    update: price != null ? { basePrice: price } : {},
    create: { sku, name, category: "Сатылым", basePrice: price ?? 0 },
  });
}

async function almatyBranchId(): Promise<string> {
  const b = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } }, select: { id: true } });
  if (!b) throw new SalesOrderError("Алматы филиалы табылмады");
  return b.id;
}

/** Форманың мәндерін тексеріп, тазалайды (қате болса — түсінікті хабар). */
export function validateSalesOrder(raw: SalesOrderIn): SalesOrderIn & { phone10: string; cars: SalesOrderCarIn[] } {
  const phone = normalizePhone(raw.customer?.phone);
  if (!phone.ok) throw new SalesOrderError("Клиенттің телефонын дұрыс жазыңыз (мыс. 8 701 123 45 67)");
  const name = clean(raw.customer?.name, 120);
  if (!name) throw new SalesOrderError("Клиенттің атын жазыңыз");
  const items = (raw.items ?? [])
    .map((i) => ({
      product: clean(i.product, 200) ?? "",
      price: money(i.price),
      soldFor: money(i.soldFor),
      leatherType: clean(i.leatherType),
      leatherThread: clean(i.leatherThread),
      leatherPiping: clean(i.leatherPiping),
      matType: clean(i.matType),
      matThread: clean(i.matThread),
      matPiping: clean(i.matPiping),
      pocketsPairs: i.pocketsPairs == null || Number.isNaN(Number(i.pocketsPairs)) ? null : Math.max(0, Math.min(10, Number(i.pocketsPairs))),
      pocketsLogo: !!i.pocketsLogo,
      workshop: !!i.workshop,
      carIndex: i.carIndex,
    }))
    .filter((i) => i.product);
  if (items.length === 0) throw new SalesOrderError("Кемінде бір тауар таңдаңыз");
  if (items.some((i) => i.soldFor == null && i.price == null)) throw new SalesOrderError("Әр тауардың бағасын немесе сатылған сомасын жазыңыз");
  const payments = (raw.payments ?? [])
    .map((p) => ({ amount: money(p.amount) ?? 0, method: clean(p.method, 60) ?? "", date: /^\d{4}-\d{2}-\d{2}$/.test(p.date ?? "") ? p.date : almatyToday() }))
    .filter((p) => p.amount > 0);
  if (payments.some((p) => !p.method)) throw new SalesOrderError("Әр төлемнің тәсілін таңдаңыз (Kaspi, қолма-қол...)");
  const normCar = (c: SalesOrderCarIn | undefined) => {
    const year = c?.year ? Number(c.year) : null;
    return {
      make: clean(canonicalMake(c?.make), 60),
      model: clean(canonicalModel(c?.model), 80),
      year: year && year > 1950 && year < 2100 ? year : null,
      generation: clean(c?.generation, 40),
      originCountry: clean(c?.originCountry, 60),
    };
  };
  const cars = (raw.cars?.length ? raw.cars : [raw.car]).slice(0, 10).map(normCar);
  const carCount = cars.length;
  return {
    customer: { phone: raw.customer.phone, name, city: clean(raw.customer.city, 60) },
    phone10: phone.value,
    channel: clean(raw.channel, 60),
    car: cars[0],
    cars,
    items: items.map((i) => ({ ...i, carIndex: Math.min(carCount - 1, Math.max(0, Math.floor(Number(i.carIndex) || 0))) })),
    payments,
    pickupMethod: clean(raw.pickupMethod, 60),
    managerBonus: money(raw.managerBonus),
    certificateNo: clean(raw.certificateNo, 40),
    comment: clean(raw.comment, 500),
  };
}

export async function createSalesOrder(user: ActingUser, raw: SalesOrderIn) {
  assertPermission(user, "orders", PermissionAction.CREATE);
  if (!user.employee) throw new SalesOrderError("Тек қызметкер профилі бар пайдаланушы заказ аша алады");
  const input = validateSalesOrder(raw);
  const branchId = await almatyBranchId();
  const today = almatyToday();
  const managerName = (await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } }))?.fullName ?? null;
  const phoneE164 = "+7" + input.phone10;

  // Клиент (телефон бойынша — қайталанбайды)
  const customer = await prisma.customer.upsert({
    where: { phone: phoneE164 },
    update: { ...(input.customer.city ? { city: input.customer.city } : {}) },
    create: { phone: phoneE164, fullName: input.customer.name, city: input.customer.city, source: input.channel },
  });

  // Көлік(тер): бар көлік қайта қолданылады, жоқ болса жасалады. Бірінші көлік — заказдың негізгі көлігі.
  const vehicleIds: (string | null)[] = [];
  for (const car of input.cars) {
    if (!car.make && !car.model) {
      vehicleIds.push(null);
      continue;
    }
    const make = car.make ?? "";
    const model = car.model ?? "";
    const same = await prisma.customerCar.findFirst({
      where: { customerId: customer.id, make: { equals: make, mode: "insensitive" }, model: { equals: model, mode: "insensitive" }, year: car.year ?? null },
      select: { id: true },
    });
    vehicleIds.push(
      same?.id ??
        (
          await prisma.customerCar.create({
            data: { customerId: customer.id, make, model, year: car.year ?? undefined, generation: car.generation, originCountry: car.originCountry },
          })
        ).id
    );
  }
  const vehicleId = vehicleIds.find((v) => v) ?? null;
  const carOf = (i: { carIndex?: number }) => input.cars[i.carIndex ?? 0] ?? input.car;

  const moneyRows = input.items.map((i) => itemMoney(i.price, i.soldFor));
  const totalAmount = moneyRows.reduce((s, m) => s + m.base, 0);
  const discountAmount = moneyRows.reduce((s, m) => s + m.discount, 0);
  const paid = input.payments.reduce((s, p) => s + p.amount, 0);
  const products = await Promise.all(input.items.map((i, k) => ensureProduct(i.product, input.items[k].price ?? moneyRows[k].base)));

  const order = await prisma.order.create({
    data: {
      orderNumber: await generateOrderNumber(),
      customerId: customer.id,
      vehicleId,
      branchId,
      createdById: user.employee.id,
      salesManagerId: user.employee.id,
      source: input.channel,
      salesChannel: input.channel,
      certificateNo: input.certificateNo,
      managerBonus: input.managerBonus ?? undefined,
      pickupMethod: input.pickupMethod,
      comment: input.comment,
      totalAmount,
      discountAmount,
      finalAmount: totalAmount - discountAmount,
      paidAmount: paid,
      status: "NEW",
      statusHistory: { create: { toStatus: "NEW", changedById: user.employee.id } },
      items: {
        create: input.items.map((i, k) => ({
          productId: products[k].id,
          productName: i.product,
          productCategory: "Сатылым",
          workshop: i.workshop,
          carId: vehicleIds[i.carIndex ?? 0] ?? vehicleId,
          qty: 1,
          basePrice: moneyRows[k].base,
          discountAmount: moneyRows[k].discount,
          unitPrice: moneyRows[k].sold,
          configuration: {
            create: {
              leatherType: i.leatherType,
              threadColor: i.leatherThread,
              edgingColor: i.leatherPiping,
              removableMatType: i.matType,
              removableMatThreadColor: i.matThread,
              removableMatEdging: i.matPiping,
              pockets: (i.pocketsPairs ?? 0) > 0,
              pocketsPairs: i.pocketsPairs ?? undefined,
              pocketsLogo: i.pocketsLogo,
            },
          },
        })),
      },
      payments: {
        create: input.payments.map((p) => {
          const parsed = parsePayment(p.method);
          return {
            amount: p.amount,
            method: paymentEnum(parsed && parsed.method ? parsed.method : null),
            cashbox: parsed && parsed.method ? parsed.account : null,
            comment: p.method,
            employeeId: user.employee!.id,
            paidAt: new Date(p.date + "T12:00:00+05:00"),
          };
        }),
      },
    },
    include: { items: { orderBy: { id: "asc" } } },
  });

  // Әр тауар → Продажи жолы (рейтинг, касса, цех, лидтер, Google кесте осы жол арқылы)
  const receipts = allocateReceipts(moneyRows.map((m) => m.sold), input.payments);
  const ledgerIds: string[] = [];
  const nos: number[] = [];
  for (let k = 0; k < input.items.length; k++) {
    const i = input.items[k];
    const rec = receipts[k];
    const row = await createLedgerRow(user, branchId, {
      date: `${today}T00:00:00Z`,
      manager: managerName,
      customerPhone: input.phone10,
      customerName: input.customer.name,
      contactChannel: input.channel ?? null,
      contactCity: input.customer.city ?? null,
      certificateNo: k === 0 ? input.certificateNo ?? null : null,
      car: carOf(i).make ?? null,
      brand: carOf(i).model ?? null,
      carYear: carOf(i).year ?? null,
      workshop: i.workshop ? "true" : "false",
      product: i.product,
      leatherType: i.leatherType ?? null,
      leatherThread: i.leatherThread ?? null,
      leatherPiping: i.leatherPiping ?? null,
      matType: i.matType ?? null,
      matThread: i.matThread ?? null,
      matPiping: i.matPiping ?? null,
      pocketsPairs: i.pocketsPairs ?? null,
      pocketsLogo: i.pocketsLogo ? "true" : null,
      price: i.price ?? moneyRows[k].base,
      soldFor: moneyRows[k].sold,
      managerBonus: k === 0 ? input.managerBonus ?? null : null,
      pickupMethod: input.pickupMethod ?? null,
      receipt1Amount: rec[0]?.amount ?? null,
      receipt1Method: rec[0]?.method ?? null,
      receipt1At: rec[0] ? `${rec[0].date}T12:00:00+05:00` : null,
      receipt2Amount: rec[1]?.amount ?? null,
      receipt2Method: rec[1]?.method ?? null,
      receipt2At: rec[1] ? `${rec[1].date}T12:00:00+05:00` : null,
      receipt3Amount: rec[2]?.amount ?? null,
      receipt3Method: rec[2]?.method ?? null,
      receipt3At: rec[2] ? `${rec[2].date}T12:00:00+05:00` : null,
    } as never);
    const updated = await recomputeLedgerRow(row.id);
    await prisma.orderItem.update({ where: { id: order.items[k].id }, data: { ledgerRowId: row.id } });
    ledgerIds.push(row.id);
    nos.push(updated.no);
  }

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "CREATE", entityType: "Order", entityId: order.id, newValue: { kind: "sales-order", orderNumber: order.orderNumber, ledgerNos: nos } },
  });
  return { orderId: order.id, orderNumber: order.orderNumber, ledgerIds, nos };
}
