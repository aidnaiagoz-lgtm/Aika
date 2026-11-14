import "server-only";
import { prisma, PermissionAction, type Prisma } from "@/lib/db";
import { assertPermission, can } from "@/lib/rbac";
import { canEditLedgerRow } from "@/lib/domain/sales-ledger";
import { workshopStatusByLedger } from "@/lib/domain/workshop";
import type { ActingUser } from "./types";
import { formatPhone, isOwnLedgerRow, paidOf, phoneNeedles, textNeedle } from "./unified-calc";

/**
 * «Заказдар» бетінің ортақ тізімі (2026-11-14, CEO шешімі):
 *  - сайттан енгізілген заказдар (Order) + Google кестеден келген ескі Продажи жолдары бір тізімде;
 *  - Продажи жолдары КӨШІРІЛМЕЙДІ — тек оқылады (рейтинг/касса екі рет санамайды);
 *  - сайт заказына байланған Продажи жолы көрсетілмейді (заказдың өзі көрсетіледі);
 *  - барлық менеджер бәрін КӨРЕДІ (Google кестедегідей), бірақ өзгертеді — тек өзінікін; басшылар — бәрін.
 */

export type OrderSource = "site" | "sheet";

export interface UnifiedRow {
  key: string;
  source: OrderSource;
  date: Date;
  label: string; // «AM-2026-000004» немесе «№11842»
  customerName: string;
  phone: string;
  car: string;
  carYear: number | null;
  products: string[];
  detail: string | null; // кожа/түс
  total: number;
  paid: number;
  remainder: number;
  manager: string;
  mine: boolean;
  workshop: "none" | "marked" | "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  /** Ашу/өзгерту сілтемесі; null — тек көру (🔒). */
  href: string | null;
  canEdit: boolean;
}

export interface UnifiedFilters {
  who: "mine" | "all";
  src: "all" | "site" | "sheet";
  q: string;
}

const isTrue = (v: string | null | undefined) => /^(true|1|да|иә|ok|✓|x)$/i.test((v ?? "").trim());
const almatyMonth = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 7);

export async function listUnifiedOrders(user: ActingUser, f: UnifiedFilters): Promise<{ rows: UnifiedRow[]; limited: boolean }> {
  const orderScope = assertPermission(user, "orders", PermissionAction.VIEW);
  const canSeeLedger = can(user, "deals", PermissionAction.VIEW);
  const me = user.employee?.id
    ? await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { id: true, fullName: true } })
    : null;
  const limit = f.q ? 200 : 100;
  const phones = phoneNeedles(f.q);
  const text = textNeedle(f.q);
  const hasSearch = phones.length > 0 || !!text;

  // ---- Сайт заказдары ----
  let siteRows: UnifiedRow[] = [];
  if (f.src !== "sheet") {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (f.who === "mine") where.salesManagerId = me?.id ?? "__none__";
    if (hasSearch) {
      where.OR = [
        ...phones.map((p) => ({ customer: { phone: { contains: p } } })),
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
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
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
            product: { select: { name: true } },
            configuration: { select: { leatherType: true, threadColor: true } },
          },
        },
      },
    });
    const ws = await workshopStatusByLedger(orders.flatMap((o) => o.items.map((i) => i.ledgerRowId).filter((x): x is string => !!x)));
    siteRows = orders.map((o) => {
      const mine = !!me && o.salesManagerId === me.id;
      const canEdit = mine || orderScope !== "OWN";
      const wsItem = o.items.find((i) => i.ledgerRowId && ws.has(i.ledgerRowId));
      const cfg = o.items[0]?.configuration;
      const total = Number(o.finalAmount);
      const paid = Number(o.paidAmount);
      return {
        key: "o:" + o.id,
        source: "site" as const,
        date: o.createdAt,
        label: o.orderNumber,
        customerName: o.customer.fullName,
        phone: formatPhone(o.customer.phone),
        car: o.vehicle ? `${o.vehicle.make} ${o.vehicle.model}`.trim() : "",
        carYear: o.vehicle?.year ?? null,
        products: o.items.map((i) => i.productName || i.product.name),
        detail: [cfg?.leatherType, cfg?.threadColor].filter(Boolean).join(" / ") || null,
        total,
        paid,
        remainder: Math.max(0, total - paid),
        manager: o.salesManager.fullName,
        mine,
        workshop: wsItem ? ws.get(wsItem.ledgerRowId!)! : o.items.some((i) => i.workshop) ? "marked" : "none",
        href: canEdit ? `/orders/${o.id}` : null,
        canEdit,
      };
    });
  }

  // ---- Google кестедегі (Продажи) ескі жолдар ----
  let sheetRows: UnifiedRow[] = [];
  if (f.src !== "site" && canSeeLedger) {
    const where: Prisma.SalesLedgerRowWhereInput = { orderItems: { none: {} } };
    if (f.who === "mine") {
      where.AND = [
        {
          OR: [
            ...(me?.fullName ? [{ manager: { equals: me.fullName.trim(), mode: "insensitive" as const } }] : []),
            { createdById: me?.id ?? "__none__" },
          ],
        },
      ];
    }
    if (hasSearch) {
      where.OR = [
        ...phones.flatMap((p) => [{ phoneNorm: { contains: p } }, { customerPhone: { contains: p } }]),
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
    const rows = await prisma.salesLedgerRow.findMany({
      where,
      orderBy: [{ date: { sort: "desc", nulls: "last" } }, { no: "desc" }],
      take: limit,
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
        receipt2Amount: true,
        receipt3Amount: true,
      },
    });
    const ws = await workshopStatusByLedger(rows.map((r) => r.id));
    sheetRows = rows.map((r) => {
      const mine = isOwnLedgerRow(r, { employeeId: me?.id, fullName: me?.fullName });
      const canEdit = canEditLedgerRow(user, r);
      const date = r.date ?? r.createdAt;
      const total = Number(r.soldFor ?? r.price ?? 0);
      const paid = paidOf(r);
      const remainder = r.remainder != null ? Math.max(0, Number(r.remainder)) : Math.max(0, total - paid);
      return {
        key: "l:" + r.id,
        source: "sheet" as const,
        date,
        label: `№${r.no}`,
        customerName: r.customerName ?? "",
        phone: formatPhone(r.phoneNorm ?? r.customerPhone),
        car: [r.car, r.brand].filter(Boolean).join(" "),
        carYear: r.carYear,
        products: r.product ? [r.product] : [],
        detail: [r.leatherType, r.leatherThread].filter(Boolean).join(" / ") || null,
        total,
        paid,
        remainder,
        manager: r.manager ?? "",
        mine,
        workshop: ws.get(r.id) ?? (isTrue(r.workshop) ? "marked" : "none"),
        href: canEdit || mine ? `/departments/sales/almaty?m=${almatyMonth(date)}` : null,
        canEdit,
      };
    });
  }

  const all = [...siteRows, ...sheetRows].sort((a, b) => b.date.getTime() - a.date.getTime());
  return { rows: all.slice(0, limit), limited: all.length > limit || siteRows.length === limit || sheetRows.length === limit };
}
