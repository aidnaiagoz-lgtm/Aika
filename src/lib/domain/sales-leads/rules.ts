import "server-only";
import { prisma } from "@/lib/db";
import { decideOlxLink, OLX_CODES, LOOKBACK_DAYS, type LeadForLink } from "./decide";
import { leadsActive } from "./state";

const DAY = 86400_000;

/**
 * Ереже 1 — Продажидегі ОЛХ сатылымы → лид «Сатылды».
 * Сайттан сақталғанда (recomputeLedgerRow) және кестеден синхрондалғанда (sheet-sync) шақырылады.
 * `allowCreate: false` — тарихты байланыстыру режимі (ескі сатылымдарға лид жасамайды, тек барын байланыстырады).
 * Қайтарады: байланысқан + жасалған лид саны.
 */
export async function linkOlxSales(rowIds: string[], opts: { allowCreate?: boolean; force?: boolean } = {}): Promise<number> {
  if (rowIds.length === 0) return 0;
  if (!opts.force && !(await leadsActive())) return 0;

  let done = 0;
  for (let i = 0; i < rowIds.length; i += 500) {
    const sales = await prisma.salesLedgerRow.findMany({
      where: { id: { in: rowIds.slice(i, i + 500) }, channelCode: { in: [...OLX_CODES] }, phoneNorm: { not: null } },
      orderBy: [{ date: "asc" }, { no: "asc" }],
    });
    if (!sales.length) continue;
    const phones = [...new Set(sales.map((s) => s.phoneNorm!))];
    const leads = await prisma.salesLead.findMany({
      where: { phoneNorm: { in: phones } },
      select: { id: true, account: true, date: true, status: true, ledgerRowId: true, soldAt: true, phoneNorm: true },
    });
    const byPhone = new Map<string, (LeadForLink & { phoneNorm: string | null })[]>();
    for (const l of leads) byPhone.set(l.phoneNorm!, [...(byPhone.get(l.phoneNorm!) ?? []), l]);

    // Бір топтағы жолдар (бір тапсырыс) ретімен өңделеді — жадтағы тізім әр әрекеттен кейін жаңарады
    for (const s of sales) {
      const list = byPhone.get(s.phoneNorm!) ?? [];
      const d = decideOlxLink({ id: s.id, phoneNorm: s.phoneNorm, channelCode: s.channelCode, date: s.date }, list, opts);
      if (d.action === "link") {
        await prisma.salesLead.update({ where: { id: d.leadId }, data: { status: "SOLD", soldAt: s.date, ledgerRowId: s.id } });
        const l = list.find((x) => x.id === d.leadId)!;
        Object.assign(l, { status: "SOLD", soldAt: s.date, ledgerRowId: s.id });
        done++;
      } else if (d.action === "create") {
        const created = await prisma.salesLead.create({
          data: {
            account: s.channelCode!,
            date: s.date!,
            managerName: s.manager,
            employeeId: s.createdById,
            customerName: s.customerName,
            phoneRaw: s.customerPhone,
            phoneNorm: s.phoneNorm,
            city: s.contactCity,
            car: [s.car, s.brand].filter(Boolean).join(" ") || null,
            status: "SOLD",
            soldAt: s.date,
            ledgerRowId: s.id,
            autoCreated: true,
          },
          select: { id: true, account: true, date: true, status: true, ledgerRowId: true, soldAt: true, phoneNorm: true },
        });
        byPhone.set(s.phoneNorm!, [...list, created]);
        done++;
      }
    }
  }
  return done;
}

/** Тарих: телефонның бұрынғы сатылымдары мен лидтері (ереже 2). */
export async function phoneHistory(phoneNorm: string) {
  const [sales, leads] = await Promise.all([
    prisma.salesLedgerRow.findMany({
      where: { phoneNorm },
      orderBy: { date: "desc" },
      take: 8,
      select: { no: true, date: true, product: true, soldFor: true, manager: true, orderStatus: true },
    }),
    prisma.salesLead.findMany({
      where: { phoneNorm },
      orderBy: { date: "desc" },
      take: 8,
      select: { date: true, account: true, managerName: true, status: true, reasonCode: true, comment: true },
    }),
  ]);
  return {
    sales: sales.map((s) => ({ ...s, date: s.date?.toISOString() ?? null, soldFor: s.soldFor == null ? null : Number(s.soldFor) })),
    leads: leads.map((l) => ({ ...l, date: l.date.toISOString() })),
  };
}

export const LEAD_LOOKBACK_DAYS = LOOKBACK_DAYS;
export const _DAY = DAY;
