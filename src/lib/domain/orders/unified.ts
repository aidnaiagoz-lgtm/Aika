import "server-only";
import { prisma, PermissionAction, type Prisma } from "@/lib/db";
import { assertPermission, can } from "@/lib/rbac";
import { canEditLedgerRow } from "@/lib/domain/sales-ledger";
import { workshopStatusByLedger } from "@/lib/domain/workshop";
import type { ActingUser } from "./types";
import { kindById, productKind } from "./product-kinds";
import {
  almatyToday,
  formatPhone,
  isOwnLedgerRow,
  ledgerGroupKey,
  ledgerLabel,
  paidOf,
  pickLedgerTime,
  periodDays,
  phoneNeedles,
  rowNoNeedle,
  shortProduct,
  textNeedle,
  type OrderPeriod,
} from "./unified-calc";

/**
 * «Заказдар» бетінің ортақ тізімі (2026-11-14, CEO шешімі):
 *  - сайттан енгізілген заказдар (Order) + Google кестеден келген ескі Продажи жолдары бір тізімде;
 *  - Продажи жолдары КӨШІРІЛМЕЙДІ — тек оқылады (рейтинг/касса екі рет санамайды);
 *  - сайт заказына байланған Продажи жолы көрсетілмейді (заказдың өзі көрсетіледі);
 *  - барлық менеджер бәрін КӨРЕДІ (Google кестедегідей), бірақ өзгертеді — тек өзінікін; басшылар — бәрін.
 *  - бір заказ = бір жол (CEO, 2026-11-14): Продажи жолдары «бір күн + бір клиент + бір менеджер» бойынша топталады,
 *    тауарлар жолдың ішінде тізіліп тұрады. Беттеу де заказ (топ) бойынша.
 */

export type OrderSource = "site" | "sheet";
export type WorkshopMark = "none" | "marked" | "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface UnifiedItem {
  kind: string; // «3Д салон», «Чехол»...
  name: string; // қысқартылған атауы
  detail: string | null; // кожа / жіп
  amount: number;
  workshop: WorkshopMark;
}

export interface UnifiedRow {
  key: string;
  source: OrderSource;
  date: Date;
  /** Заказ түскен уақыт (сағат:минут үшін); белгісіз болса — null. */
  time: Date | null;
  label: string; // «AM-2026-000004» немесе «№12460–12464»
  /** Google кестедегі № (Продажи жолы): «12460–12464»; жоқ болса — "". */
  no: string;
  customerName: string;
  phone: string;
  car: string;
  carYear: number | null;
  items: UnifiedItem[];
  total: number;
  paid: number;
  remainder: number;
  manager: string;
  mine: boolean;
  /** Ашу/өзгерту сілтемесі; null — тек көру (🔒). */
  href: string | null;
  canEdit: boolean;
}

export interface UnifiedFilters {
  who: "mine" | "all";
  src: "all" | "site" | "sheet";
  q: string;
  /** Бет нөмірі (1-ден): әр бетте 100 заказ. */
  page?: number;
  /** Бүгін / Кеше / Апта / Ай / Барлығы (Алматы уақытымен). */
  period?: OrderPeriod;
}

export const PAGE_SIZE = 100;

const isTrue = (v: string | null | undefined) => /^(true|1|да|иә|ok|✓|x)$/i.test((v ?? "").trim());
const almatyMonth = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 7);
/** Түрі бөлек көрсетілетіндіктен атаудың басындағы түр сөзін алып тастаймыз: «3Д - Люкс - салон» → «Люкс - салон». */
const KIND_PREFIX = /^(3д|5д|360|багаж|съ[её]мный|ева|eva|тпе|tpe|чехол|руль|подпятник|накидка|органайзер|подушка|подлокотник)\s*-\s*/i;
const itemName = (raw: string | null | undefined, kind: string) => {
  const short = shortProduct(raw);
  const s = kind ? short.replace(KIND_PREFIX, "").replace(/^-\s*/, "").trim() : short;
  return s || short || "—";
};
const kindLabel = (name: string) => {
  const k = productKind(name);
  return k === "other" ? "" : kindById(k).label;
};

// Бір заказ — бірнеше groupBy тобы болуы мүмкін (аты/менеджер әріп регистрі әр түрлі: «Даулет»/«даулет»).
type PageKey = { t: number; tie: number } & ({ kind: "o"; id: string } | { kind: "l"; key: string; gs: LedgerGroup[] });
interface LedgerGroup {
  date: Date | null;
  phoneNorm: string | null;
  customerName: string | null;
  manager: string | null;
}

export async function listUnifiedOrders(
  user: ActingUser,
  f: UnifiedFilters
): Promise<{ rows: UnifiedRow[]; total: number; sum: number; page: number; pages: number }> {
  const orderScope = assertPermission(user, "orders", PermissionAction.VIEW);
  const canSeeLedger = can(user, "deals", PermissionAction.VIEW);
  const me = user.employee?.id
    ? await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { id: true, fullName: true } })
    : null;
  const page = Math.max(1, Math.min(200, Math.floor(f.page ?? 1)));
  let sum = 0;
  const days = periodDays(f.period ?? "all", almatyToday());
  const phones = phoneNeedles(f.q);
  // «№12459» — Google кестедегі жол нөмірі бойынша іздеу (CEO, 2026-11-14)
  const rowNo = rowNoNeedle(f.q);
  const text = rowNo != null && /№/.test(f.q) ? null : textNeedle(f.q);
  const hasSearch = phones.length > 0 || !!text || rowNo != null;
  const keys: PageKey[] = [];

  // ---- Сайт заказдары: сүзгі + кілттер ----
  const orderWhere: Prisma.OrderWhereInput = { deletedAt: null };
  if (f.src !== "sheet") {
    if (days) orderWhere.createdAt = { gte: new Date(`${days[0]}T00:00:00+05:00`), lte: new Date(`${days[1]}T23:59:59.999+05:00`) };
    if (f.who === "mine") orderWhere.salesManagerId = me?.id ?? "__none__";
    if (hasSearch) {
      orderWhere.OR = [
        ...phones.map((p) => ({ customer: { phone: { contains: p } } })),
        // сайт заказы: «AM-2026-000004» — соңғы цифрлары бойынша, немесе оның Продажи жолының № бойынша
        ...(rowNo != null
          ? [{ orderNumber: { endsWith: String(rowNo).padStart(6, "0") } }, { items: { some: { ledgerRow: { no: rowNo } } } }]
          : []),
        ...(text
          ? [
              { orderNumber: { contains: text, mode: "insensitive" as const } },
              { customer: { fullName: { contains: text, mode: "insensitive" as const } } },
              { vehicle: { make: { contains: text, mode: "insensitive" as const } } },
              { vehicle: { model: { contains: text, mode: "insensitive" as const } } },
              { items: { some: { productName: { contains: text, mode: "insensitive" as const } } } },
            ]
          : []),
      ];
    }
    const agg = await prisma.order.aggregate({ where: orderWhere, _sum: { finalAmount: true } });
    sum += Number(agg._sum.finalAmount ?? 0);
    const ids = await prisma.order.findMany({ where: orderWhere, select: { id: true, createdAt: true } });
    for (const o of ids) keys.push({ kind: "o", id: o.id, t: o.createdAt.getTime(), tie: 0 });
  }

  // ---- Google кестедегі (Продажи) жолдар: заказға топтау ----
  const ledgerWhere: Prisma.SalesLedgerRowWhereInput = { orderItems: { none: {} } };
  if (f.src !== "site" && canSeeLedger) {
    // Продажи «Дата» — күн (UTC 00:00 ретінде сақталады)
    if (days) ledgerWhere.date = { gte: new Date(`${days[0]}T00:00:00Z`), lte: new Date(`${days[1]}T23:59:59.999Z`) };
    if (f.who === "mine") {
      ledgerWhere.AND = [
        {
          OR: [
            ...(me?.fullName ? [{ manager: { equals: me.fullName.trim(), mode: "insensitive" as const } }] : []),
            { createdById: me?.id ?? "__none__" },
          ],
        },
      ];
    }
    if (hasSearch) {
      ledgerWhere.OR = [
        ...phones.flatMap((p) => [{ phoneNorm: { contains: p } }, { customerPhone: { contains: p } }]),
        ...(rowNo != null ? [{ no: rowNo }] : []),
        ...(text
          ? [
              { customerName: { contains: text, mode: "insensitive" as const } },
              { car: { contains: text, mode: "insensitive" as const } },
              { brand: { contains: text, mode: "insensitive" as const } },
              { product: { contains: text, mode: "insensitive" as const } },
            ]
          : []),
      ];
    }
    const agg = await prisma.salesLedgerRow.aggregate({ where: ledgerWhere, _sum: { soldFor: true } });
    sum += Number(agg._sum.soldFor ?? 0);
    const groups = await prisma.salesLedgerRow.groupBy({
      by: ["date", "phoneNorm", "customerName", "manager"],
      where: ledgerWhere,
      _max: { no: true },
    });
    const merged = new Map<string, Extract<PageKey, { kind: "l" }>>();
    for (const g of groups) {
      const raw = { date: g.date, phoneNorm: g.phoneNorm, customerName: g.customerName, manager: g.manager };
      const key = ledgerGroupKey(raw);
      const cur = merged.get(key);
      if (cur) {
        cur.gs.push(raw);
        cur.tie = Math.max(cur.tie, g._max.no ?? 0);
      } else merged.set(key, { kind: "l", key, gs: [raw], t: g.date ? g.date.getTime() : 0, tie: g._max.no ?? 0 });
    }
    keys.push(...merged.values());
  }

  // ---- Беттеу (заказ бойынша) ----
  keys.sort((a, b) => b.t - a.t || b.tie - a.tie);
  const total = keys.length;
  const slice = keys.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const orderIds = slice.flatMap((k) => (k.kind === "o" ? [k.id] : []));
  const ledgerGroups = slice.flatMap((k) => (k.kind === "l" ? k.gs : []));

  // ---- Сайт заказдарының толық деректері ----
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          finalAmount: true,
          paidAmount: true,
          salesManagerId: true,
          customer: { select: { fullName: true, phone: true } },
          vehicle: { select: { make: true, model: true, year: true } },
          salesManager: { select: { fullName: true } },
          items: {
            orderBy: { id: "asc" },
            select: {
              productName: true,
              workshop: true,
              ledgerRowId: true,
              ledgerRow: { select: { no: true } },
              unitPrice: true,
              qty: true,
              product: { select: { name: true } },
              configuration: { select: { leatherType: true, threadColor: true } },
            },
          },
        },
      })
    : [];
  const orderWs = await workshopStatusByLedger(orders.flatMap((o) => o.items.map((i) => i.ledgerRowId).filter((x): x is string => !!x)));
  const byId = new Map<string, UnifiedRow>();
  for (const o of orders) {
    const mine = !!me && o.salesManagerId === me.id;
    const canEdit = mine || orderScope !== "OWN";
    const total = Number(o.finalAmount);
    const paid = Number(o.paidAmount);
    byId.set("o:" + o.id, {
      key: "o:" + o.id,
      source: "site",
      date: o.createdAt,
      time: o.createdAt,
      label: o.orderNumber,
      no: ledgerLabel(o.items.flatMap((i) => (i.ledgerRow ? [i.ledgerRow.no] : []))).replace("№", ""),
      customerName: o.customer.fullName,
      phone: formatPhone(o.customer.phone),
      car: o.vehicle ? `${o.vehicle.make} ${o.vehicle.model}`.trim() : "",
      carYear: o.vehicle?.year ?? null,
      items: o.items.map((i) => {
        const name = i.productName || i.product.name;
        const kind = kindLabel(name);
        return {
          kind,
          name: itemName(name, kind),
          detail: [i.configuration?.leatherType, i.configuration?.threadColor].filter(Boolean).join(" / ") || null,
          amount: Number(i.unitPrice) * (i.qty || 1),
          workshop: (i.ledgerRowId && orderWs.get(i.ledgerRowId)) || (i.workshop ? "marked" : "none"),
        };
      }),
      total,
      paid,
      remainder: Math.max(0, total - paid),
      manager: o.salesManager.fullName,
      mine,
      href: canEdit ? `/orders/${o.id}` : null,
      canEdit,
    });
  }

  // ---- Продажи топтарының жолдары ----
  const ledgerRows = ledgerGroups.length
    ? await prisma.salesLedgerRow.findMany({
        where: { AND: [ledgerWhere, { OR: ledgerGroups.map((g) => ({ ...g })) }] },
        orderBy: { no: "asc" },
        select: {
          id: true,
          no: true,
          date: true,
          createdAt: true,
          manager: true,
          createdById: true,
          customerName: true,
          customerPhone: true,
          phoneNorm: true,
          car: true,
          brand: true,
          carYear: true,
          product: true,
          leatherType: true,
          leatherThread: true,
          workshop: true,
          price: true,
          soldFor: true,
          remainder: true,
          receipt1Amount: true,
          receipt1At: true,
          receipt2Amount: true,
          receipt3Amount: true,
        },
      })
    : [];
  const ledgerWs = await workshopStatusByLedger(ledgerRows.map((r) => r.id));
  const grouped = new Map<string, typeof ledgerRows>();
  for (const r of ledgerRows) {
    const k = ledgerGroupKey(r);
    grouped.set(k, [...(grouped.get(k) ?? []), r]);
  }
  for (const [k, rows] of grouped) {
    const r0 = rows[0];
    const date = r0.date ?? r0.createdAt;
    const mine = rows.some((r) => isOwnLedgerRow(r, { employeeId: me?.id, fullName: me?.fullName }));
    const canEdit = rows.some((r) => canEditLedgerRow(user, r));
    let total = 0;
    let paid = 0;
    let remainder = 0;
    const items: UnifiedItem[] = rows.map((r) => {
      const amount = Number(r.soldFor ?? r.price ?? 0);
      const p = paidOf(r);
      total += amount;
      paid += p;
      remainder += r.remainder != null ? Math.max(0, Number(r.remainder)) : Math.max(0, amount - p);
      const kind = kindLabel(r.product ?? "");
      return {
        kind,
        name: itemName(r.product, kind),
        detail: [r.leatherType, r.leatherThread].filter(Boolean).join(" / ") || null,
        amount,
        workshop: ledgerWs.get(r.id) ?? (isTrue(r.workshop) ? "marked" : "none"),
      };
    });
    const firstCar = rows.find((r) => r.car || r.brand) ?? r0;
    byId.set("l:" + k, {
      key: "l:" + k,
      source: "sheet",
      date,
      time: pickLedgerTime(r0.date, rows.flatMap((r) => [r.createdAt, r.receipt1At])),
      label: ledgerLabel(rows.map((r) => r.no)),
      no: ledgerLabel(rows.map((r) => r.no)).replace("№", ""),
      customerName: rows.find((r) => r.customerName)?.customerName ?? "",
      phone: formatPhone(r0.phoneNorm ?? rows.find((r) => r.customerPhone)?.customerPhone),
      car: [firstCar.car, firstCar.brand].filter(Boolean).join(" "),
      carYear: firstCar.carYear,
      items,
      total,
      paid,
      remainder,
      manager: r0.manager ?? "",
      mine,
      href: canEdit || mine ? `/departments/sales/almaty?m=${almatyMonth(date)}` : null,
      canEdit,
    });
  }

  const rows = slice
    .map((k) => byId.get(k.kind === "o" ? "o:" + k.id : "l:" + k.key))
    .filter((r): r is UnifiedRow => !!r);
  // Бір күннің ішінде — түскен уақыты бойынша (жаңасы жоғарыда); уақыты белгісіздер — сол күннің соңында
  const dayOf = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
  rows.sort((a, b) => {
    const da = dayOf(a.date);
    const db = dayOf(b.date);
    if (da !== db) return da < db ? 1 : -1;
    return (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0);
  });
  return { rows, total, sum, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
