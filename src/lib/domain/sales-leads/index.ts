import "server-only";
import { prisma } from "@/lib/db";
import { isLeader } from "@/lib/access";
import type { SessionUser } from "@/lib/session";
import { normalizePhone, formatPhone } from "../sales-ledger/normalize/phone";
import { LEAD_REASONS, channelLabel } from "../sales-ledger/normalize/dictionaries";
import { createLedgerRow, recomputeLedgerRow } from "../sales-ledger";
import { leadsActive } from "./state";

export { phoneHistory } from "./rules";
export { runLeadImport } from "./sheet-import";
export { leadsActive } from "./state";

export const LEAD_ACCOUNTS = [
  { code: "OLX_1", label: "ОЛХ-1" },
  { code: "OLX_2", label: "ОЛХ-2" },
  { code: "WHATSAPP", label: "ватсап" },
  { code: "INSTAGRAM", label: "инстаграм" },
  { code: "WALK_IN", label: "өзі келді" },
  { code: "OTHER", label: "басқа" },
] as const;
export const LEAD_STATUS_LABEL = { NEW: "Жаңа", IN_PROGRESS: "Жұмыста", SOLD: "Сатылды", LOST: "Жабылды" } as const;
export type LeadStatus = keyof typeof LEAD_STATUS_LABEL;

export const accountLabel = (code: string) => LEAD_ACCOUNTS.find((a) => a.code === code)?.label ?? channelLabel(code) ?? code;
export const reasonLabel = (code: string | null) => (code ? LEAD_REASONS.find((r) => r.code === code)?.label ?? code : null);

/** Менеджер — өз лидтерін өңдейді (бәрін көреді). CEO / РОП — бәрін. */
export function canEditLead(user: SessionUser, lead: { employeeId: string | null; createdById: string | null }) {
  if (isLeader(user)) return true;
  const me = user.employee?.id;
  return !!me && (lead.employeeId === me || lead.createdById === me);
}

/** Алматы күнінің соңы (UTC) — «бүгін қоңырау» сүзгісі үшін. */
function endOfTodayAlmaty() {
  const now = new Date(Date.now() + 5 * 3600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - 5 * 3600_000);
}
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1) - 5 * 3600_000), lt: new Date(Date.UTC(y, m, 1) - 5 * 3600_000) };
}

export type LeadFilters = { month: string; account?: string; manager?: string; reason?: string; today?: boolean; status?: string };

export async function listLeads(user: SessionUser, f: LeadFilters) {
  const where: Record<string, unknown> = {};
  if (f.today) {
    where.followUpAt = { lte: endOfTodayAlmaty() };
    where.status = { in: ["NEW", "IN_PROGRESS"] };
  } else where.date = monthRange(f.month);
  if (f.account) where.account = f.account;
  if (f.manager) where.managerName = f.manager;
  if (f.reason) where.reasonCode = f.reason;
  if (f.status && !f.today) where.status = f.status;
  const leads = await prisma.salesLead.findMany({
    where,
    orderBy: f.today ? [{ followUpAt: "asc" }] : [{ date: "desc" }, { createdAt: "desc" }],
    take: 400,
    include: { ledgerRow: { select: { no: true } } },
  });
  return leads.map((l) => ({
    id: l.id,
    date: l.date.toISOString(),
    account: l.account,
    managerName: l.managerName,
    customerName: l.customerName,
    phone: l.phoneNorm ? formatPhone(l.phoneNorm) : l.phoneRaw,
    city: l.city,
    car: l.car,
    comment: l.comment,
    reasonCode: l.reasonCode,
    status: l.status as LeadStatus,
    followUpAt: l.followUpAt?.toISOString() ?? null,
    saleNo: l.ledgerRow?.no ?? null,
    synced: !!l.importKey,
    editable: canEditLead(user, l),
  }));
}
export type LeadItem = Awaited<ReturnType<typeof listLeads>>[number];

/** Воронка мен себептер — таңдалған ай бойынша. */
export async function leadStats(month: string, account?: string) {
  const where = { date: monthRange(month), ...(account ? { account } : {}) };
  const [total, withPhone, sold, reasons, managers] = await Promise.all([
    prisma.salesLead.count({ where }),
    prisma.salesLead.count({ where: { ...where, phoneNorm: { not: null } } }),
    prisma.salesLead.count({ where: { ...where, status: "SOLD" } }),
    prisma.salesLead.groupBy({ by: ["reasonCode"], where: { ...where, reasonCode: { not: null } }, _count: { _all: true } }),
    prisma.salesLead.groupBy({ by: ["managerName"], where: { ...where, managerName: { not: null } }, _count: { _all: true } }),
  ]);
  return {
    total,
    withPhone,
    sold,
    reasons: reasons.map((r) => ({ code: r.reasonCode!, label: reasonLabel(r.reasonCode)!, count: r._count._all })).sort((a, b) => b.count - a.count),
    managers: managers.map((m) => m.managerName!).sort(),
  };
}

export type NewLeadInput = { phone: string; account: string; customerName?: string; city?: string; car?: string; reasonCode?: string; comment?: string; followUpAt?: string };

export async function createLead(user: SessionUser, input: NewLeadInput) {
  const ph = normalizePhone(input.phone);
  if (!ph.ok) throw new Error(ph.reason === "empty" ? "Телефонды жазыңыз" : "Телефон нөмірі қате — 8 7xx xxx xx xx");
  if (!LEAD_ACCOUNTS.some((a) => a.code === input.account)) throw new Error("Аккаунтты таңдаңыз");
  const me = user.employee;
  return prisma.salesLead.create({
    data: {
      account: input.account,
      date: new Date(),
      managerName: me?.fullName ?? null,
      employeeId: me?.id ?? null,
      createdById: me?.id ?? null,
      phoneRaw: input.phone.trim(),
      phoneNorm: ph.value,
      customerName: clean(input.customerName),
      city: clean(input.city),
      car: clean(input.car),
      comment: clean(input.comment),
      reasonCode: input.reasonCode && LEAD_REASONS.some((r) => r.code === input.reasonCode) ? input.reasonCode : null,
      followUpAt: input.followUpAt ? almatyDay(input.followUpAt) : null,
      status: input.followUpAt || input.reasonCode ? "IN_PROGRESS" : "NEW",
    },
  });
}

export type LeadPatch = { status?: LeadStatus; reasonCode?: string | null; followUpAt?: string | null; customerName?: string; city?: string; car?: string; comment?: string };

/** Кестеден келген лидте тек сайтта жүргізілетін өрістер өзгереді (күйі, себеп, келесі қоңырау). */
export async function updateLead(user: SessionUser, id: string, patch: LeadPatch) {
  const lead = await prisma.salesLead.findUniqueOrThrow({ where: { id } });
  if (!canEditLead(user, lead)) throw new Error("Бұл лидті тек оның менеджері өзгерте алады");
  const data: Record<string, unknown> = {};
  if (patch.status && patch.status in LEAD_STATUS_LABEL && patch.status !== "SOLD") data.status = patch.status;
  if (patch.reasonCode !== undefined) data.reasonCode = patch.reasonCode && LEAD_REASONS.some((r) => r.code === patch.reasonCode) ? patch.reasonCode : null;
  if (patch.followUpAt !== undefined) data.followUpAt = patch.followUpAt ? almatyDay(patch.followUpAt) : null;
  if (!lead.importKey) {
    for (const k of ["customerName", "city", "car", "comment"] as const) if (patch[k] !== undefined) data[k] = clean(patch[k]);
  }
  if ((data.followUpAt || data.reasonCode) && lead.status === "NEW" && !data.status) data.status = "IN_PROGRESS";
  return prisma.salesLead.update({ where: { id }, data });
}

/**
 * Ереже 3 — «Сатылымға айналдыру»: Продажиде алдын ала толтырылған жаңа жол ашады
 * (клиент, телефон, қала, көлік, канал, менеджер) және лидті сол жолмен байланыстырады.
 */
export async function convertLeadToSale(user: SessionUser, id: string) {
  const lead = await prisma.salesLead.findUniqueOrThrow({ where: { id } });
  if (!canEditLead(user, lead)) throw new Error("Бұл лидті тек оның менеджері айналдыра алады");
  if (lead.ledgerRowId) {
    const r = await prisma.salesLedgerRow.findUnique({ where: { id: lead.ledgerRowId }, select: { no: true, date: true } });
    if (r) return { no: r.no, month: monthOf(r.date ?? new Date()) };
  }
  const branch = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } } });
  if (!branch) throw new Error("Алматы филиалы табылмады");
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const row = await createLedgerRow(user, branch.id, {
    date: `${today}T00:00:00Z`,
    manager: lead.managerName ?? user.employee?.fullName ?? null,
    customerPhone: lead.phoneNorm ? "8" + lead.phoneNorm : lead.phoneRaw,
    customerName: lead.customerName,
    contactCity: lead.city,
    brand: lead.car,
    contactChannel: lead.account === "OLX_1" ? "ОЛХ-1" : lead.account === "OLX_2" ? "ОЛХ-2" : channelLabel(lead.account),
  } as never);
  await prisma.salesLead.update({ where: { id }, data: { status: "SOLD", soldAt: new Date(), ledgerRowId: row.id } });
  await recomputeLedgerRow(row.id);
  return { no: row.no, month: today.slice(0, 7) };
}

function clean(v: string | undefined | null) {
  const s = (v ?? "").trim();
  return s ? s : null;
}
function almatyDay(ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Күн форматы қате");
  return new Date(`${ymd}T09:00:00+05:00`); // күннің басы, Алматы
}
const monthOf = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 7);

export async function leadsSystemActive() {
  return leadsActive();
}
