import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { salesSheetId } from "../sales-ledger/normalize/sheet-id";
import { parseCsv } from "../sales-ledger/normalize/csv";
import { normalizePhone } from "../sales-ledger/normalize/phone";
import { matchChannel } from "../sales-ledger/normalize/dictionaries";
import { LEAD_SHEETS, findLeadHeader, mapLeadRow, type LeadSheetKey, type LeadSheetRow } from "./map";
import { findAutoLeadToMerge } from "./decide";
import { OLX_CODES } from "./decide";
import { linkOlxSales } from "./rules";
import { activateLeads, leadsActive } from "./state";

async function fetchSheet(key: LeadSheetKey): Promise<LeadSheetRow[]> {
  const id = salesSheetId();
  const s = LEAD_SHEETS[key];
  const gid = process.env[s.gidEnv] ?? s.gid;
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=${encodeURIComponent(gid)}`, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`«${s.label}» парағы: Google жауабы ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith("<")) throw new Error(`«${s.label}» парағы: CSV орнына бет келді`);
  const rows = parseCsv(text);
  const h = findLeadHeader(rows);
  if (!h) throw new Error(`«${s.label}» парағында «№ | Дата | Менеджер» тақырыбы табылмады`);
  const out: LeadSheetRow[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(h.headerIndex + 1)) {
    const l = mapLeadRow(key, h.cols, r);
    if (l && !seen.has(l.importKey)) seen.add(l.importKey), out.push(l);
  }
  return out;
}

const SHEET_FIELDS = ["account", "date", "managerName", "customerName", "phoneRaw", "phoneNorm", "city", "car", "comment", "reach", "clicks"] as const;
const eq = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : (a ?? null) === (b ?? null));

type Stats = { sheet: string; rows: number; created: number; updated: number; merged: number; unchanged: number; withPhone: number };

/**
 * Лид парақтарын базаға жазу (dryRun=true болса — тек санайды, ештеңе жазбайды).
 * Қайта іске қосқанда дубль жасалмайды: кілт — importKey ("olx1:<№>"). Кестеден келетін өрістер ғана жаңарады;
 * сайтта қойылатындар (күйі, келесі қоңырау, сатылыммен байланыс, қолмен қойылған себеп) өзгермейді.
 */
export async function importLeadSheets(opts: { dryRun: boolean }): Promise<Stats[]> {
  const employees = await prisma.employee.findMany({ select: { id: true, fullName: true } });
  const byName = new Map(employees.map((e) => [e.fullName.trim().toLocaleLowerCase("ru"), e.id]));
  const result: Stats[] = [];

  for (const key of Object.keys(LEAD_SHEETS) as LeadSheetKey[]) {
    const rows = await fetchSheet(key);
    const existing = await prisma.salesLead.findMany({ where: { importKey: { startsWith: `${key}:` } } });
    const byKey = new Map(existing.map((e) => [e.importKey!, e]));
    const phones = [...new Set(rows.filter((r) => r.phoneNorm && !byKey.has(r.importKey)).map((r) => r.phoneNorm!))];
    const autos = phones.length
      ? await prisma.salesLead.findMany({
          where: { autoCreated: true, importKey: null, phoneNorm: { in: phones } },
          select: { id: true, phoneNorm: true, soldAt: true, importKey: true, autoCreated: true },
        })
      : [];
    const st: Stats = { sheet: LEAD_SHEETS[key].label, rows: rows.length, created: 0, updated: 0, merged: 0, unchanged: 0, withPhone: rows.filter((r) => r.phoneNorm).length };
    const toCreate: Prisma.SalesLeadCreateManyInput[] = [];

    for (const r of rows) {
      const employeeId = r.managerName ? byName.get(r.managerName.toLocaleLowerCase("ru")) ?? null : null;
      const sheetData = { account: r.account, date: r.date, managerName: r.managerName, customerName: r.customerName, phoneRaw: r.phoneRaw, phoneNorm: r.phoneNorm, city: r.city, car: r.car, comment: r.comment, reach: r.reach, clicks: r.clicks };
      const cur = byKey.get(r.importKey);
      if (cur) {
        const changed: Record<string, unknown> = {};
        for (const f of SHEET_FIELDS) if (!eq(cur[f], sheetData[f])) changed[f] = sheetData[f];
        if (!cur.reasonCode && r.reasonGuess) changed.reasonCode = r.reasonGuess;
        if (!cur.employeeId && employeeId) changed.employeeId = employeeId;
        if (Object.keys(changed).length) {
          st.updated++;
          if (!opts.dryRun) await prisma.salesLead.update({ where: { id: cur.id }, data: changed });
        } else st.unchanged++;
        continue;
      }
      const autoId = findAutoLeadToMerge({ phoneNorm: r.phoneNorm, date: r.date }, autos);
      if (autoId) {
        st.merged++;
        const a = autos.find((x) => x.id === autoId)!;
        a.importKey = r.importKey; // бір авто-лид екі рет біріктірілмесін
        if (!opts.dryRun)
          await prisma.salesLead.update({ where: { id: autoId }, data: { ...sheetData, importKey: r.importKey, employeeId, reasonCode: r.reasonGuess, autoCreated: false } });
        continue;
      }
      st.created++;
      toCreate.push({ ...sheetData, importKey: r.importKey, employeeId, reasonCode: r.reasonGuess, status: "NEW" });
    }
    if (!opts.dryRun) for (let i = 0; i < toCreate.length; i += 1000) await prisma.salesLead.createMany({ data: toCreate.slice(i, i + 1000), skipDuplicates: true });
    result.push(st);
  }
  return result;
}

/** Синхрондау кезінде (2 мин сайын): лидтер жүйесі қосулы болса ғана. */
export async function syncLeadSheets() {
  if (!(await leadsActive())) return { skipped: true };
  const r = await importLeadSheets({ dryRun: false });
  return r.map((s) => ({ sheet: s.sheet, created: s.created, updated: s.updated, merged: s.merged }));
}

/** Продажидегі барлық жолдың телефон/канал кодын толтыру — тек бос тұрғандарына (өшірмейді, тек толтырады). */
async function backfillLedgerNormalized(dryRun: boolean) {
  const rows = await prisma.salesLedgerRow.findMany({
    where: { OR: [{ phoneNorm: null, customerPhone: { not: null } }, { channelCode: null, contactChannel: { not: null } }] },
    select: { id: true, customerPhone: true, contactChannel: true, phoneNorm: true, channelCode: true },
  });
  const vals = rows.map((r) => {
    const ph = normalizePhone(r.customerPhone);
    const ch = matchChannel(r.contactChannel);
    return { id: r.id, p: r.phoneNorm ?? (ph.ok ? ph.value : null), c: r.channelCode ?? (ch && ch.code ? ch.code : null) };
  });
  if (!dryRun) {
    for (let i = 0; i < vals.length; i += 1000) {
      const chunk = vals.slice(i, i + 1000);
      await prisma.$executeRaw`UPDATE sales_ledger_rows AS t SET "phoneNorm" = v.p, "channelCode" = v.c
        FROM (VALUES ${Prisma.join(chunk.map((v) => Prisma.sql`(${v.id}, ${v.p}, ${v.c})`))}) AS v(id, p, c)
        WHERE t.id = v.id`;
    }
  }
  return { rows: vals.length, withPhone: vals.filter((v) => v.p).length, olx: vals.filter((v) => v.c && OLX_CODES.has(v.c)).length };
}

/**
 * CEO / РОП: «Алдын ала тексеру» (dryRun) немесе «Импорт».
 * Импорт: лид парақтары → база, Продажи жолдарының телефон/канал кодын толтыру, ескі ОЛХ сатылымдарын
 * бар лидтермен байланыстыру (ескі сатылымдарға жаңа лид ЖАСАЛМАЙДЫ), сосын лидтер жүйесін қосу.
 */
export async function runLeadImport(opts: { dryRun: boolean }) {
  const sheets = await importLeadSheets(opts);
  const backfill = await backfillLedgerNormalized(opts.dryRun);
  let linked = 0;
  if (!opts.dryRun) {
    const olxRows = await prisma.salesLedgerRow.findMany({
      where: { channelCode: { in: [...OLX_CODES] }, phoneNorm: { not: null } },
      select: { id: true },
      orderBy: { date: "asc" },
    });
    linked = await linkOlxSales(
      olxRows.map((r) => r.id),
      { allowCreate: false, force: true }
    );
    await activateLeads();
    await prisma.auditLog.create({ data: { action: "IMPORT", entityType: "SalesLead", entityId: "olx-sheets", newValue: { sheets, backfill, linked } as object } });
  }
  return { sheets, backfill, linked, dryRun: opts.dryRun };
}
