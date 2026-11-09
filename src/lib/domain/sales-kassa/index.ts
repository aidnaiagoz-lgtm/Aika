import "server-only";
import { prisma } from "@/lib/db";
import { isLeader, hasAnyRole } from "@/lib/access";
import type { SessionUser } from "@/lib/session";
import { parseCsv } from "../sales-ledger/normalize/csv";
import { parseSheetDate } from "../sales-ledger/normalize/dates";
import { canonicalManager } from "../sales-ledger/normalize/managers";
import { cashReceipts, stageOf, holderOf, nextStep, eventsFromSheet, matchReceiptNo, OWNER_NAME, STAGE_LABEL, type Stage, type Step } from "./chain";

export { STAGE_LABEL, OWNER_NAME } from "./chain";
export type { Stage, Step } from "./chain";

const K_ACTIVE = "sales.kassa.activeSince";
const K_SENIOR = "sales.kassa.senior";
const K_OPEN_FROM = "sales.kassa.openFrom";
const DAY = 86400_000;

// ───────── баптаулар ─────────
export async function kassaActiveSince(): Promise<Date | null> {
  const r = await prisma.appSetting.findUnique({ where: { key: K_ACTIVE } });
  return r ? new Date(r.value) : null;
}

/** Есеп басталатын күн (CEO өзгерте алады). Әдепкі — Касса қосылғаннан 30 күн бұрын. */
export async function kassaOpenFrom(): Promise<Date | null> {
  const [r, since] = await Promise.all([prisma.appSetting.findUnique({ where: { key: K_OPEN_FROM } }), kassaActiveSince()]);
  if (r) return new Date(r.value);
  return since ? new Date(since.getTime() - 30 * DAY) : null;
}

export async function setOpenFrom(user: SessionUser, ymd: string) {
  if (!isLeader(user)) throw new Error("Тек CEO / РОП");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Күн форматы қате");
  const v = new Date(`${ymd}T00:00:00+05:00`).toISOString();
  await prisma.appSetting.upsert({ where: { key: K_OPEN_FROM }, update: { value: v }, create: { key: K_OPEN_FROM, value: v } });
}

/** ст МОП: CEO таңдаған қызметкер; таңдалмаса — «Зере» (ескі касса парағында ақша 1496 рет соған берілген). */
export async function getSenior(): Promise<{ id: string; fullName: string } | null> {
  const r = await prisma.appSetting.findUnique({ where: { key: K_SENIOR } });
  if (r) return prisma.employee.findUnique({ where: { id: r.value }, select: { id: true, fullName: true } });
  return prisma.employee.findFirst({ where: { fullName: "Зере", status: "ACTIVE" }, select: { id: true, fullName: true } });
}

export async function setSenior(user: SessionUser, employeeId: string) {
  if (!hasAnyRole(user, ["CEO"]) && !isLeader(user)) throw new Error("Тек CEO / РОП");
  await prisma.appSetting.upsert({ where: { key: K_SENIOR }, update: { value: employeeId }, create: { key: K_SENIOR, value: employeeId } });
}

const isOwner = (u: SessionUser) => hasAnyRole(u, ["CEO"]);
const norm = (s: string | null | undefined) => (s ?? "").trim().toLocaleLowerCase("ru");

// ───────── деректер ─────────
async function loadRows() {
  const cash = { contains: "налич", mode: "insensitive" as const };
  return prisma.salesLedgerRow.findMany({
    where: { OR: [{ receipt1Method: cash }, { receipt2Method: cash }, { receipt3Method: cash }] },
    orderBy: [{ date: "desc" }, { no: "desc" }],
    include: { cashEvents: { include: { user: { select: { employee: { select: { fullName: true } }, email: true } } } } },
  });
}

export type CashItem = {
  key: string; // ledgerRowId:receiptNo
  ledgerRowId: string;
  no: number;
  date: string | null;
  manager: string | null;
  customer: string | null;
  receiptNo: number;
  amount: number;
  kind: string;
  at: string | null;
  stage: Stage;
  handedTo: string | null;
  events: { step: Step; at: string; who: string | null; toName: string | null; source: string }[];
  action: Step | null;
  mine: boolean;
};

export async function loadKassa(user: SessionUser, month: string) {
  const [rows, since, openFrom, senior] = await Promise.all([loadRows(), kassaActiveSince(), kassaOpenFrom(), getSenior()]);
  const me = user.employee;
  const amSenior = !!me && !!senior && me.id === senior.id;
  const leader = isLeader(user);
  const owner = isOwner(user);
  const [y, m] = month.split("-").map(Number);
  const mFrom = Date.UTC(y, m - 1, 1) - 5 * 3600_000;
  const mTo = Date.UTC(y, m, 1) - 5 * 3600_000;
  const todayStart = (() => {
    const n = new Date(Date.now() + 5 * 3600_000);
    return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 5 * 3600_000;
  })();

  const items: CashItem[] = [];
  for (const r of rows) {
    const receipts = cashReceipts({
      soldFor: r.soldFor == null ? null : Number(r.soldFor),
      date: r.date,
      receipts: [
        { no: 1, amount: r.receipt1Amount == null ? null : Number(r.receipt1Amount), method: r.receipt1Method, at: r.receipt1At },
        { no: 2, amount: r.receipt2Amount == null ? null : Number(r.receipt2Amount), method: r.receipt2Method, at: r.receipt2At },
        { no: 3, amount: r.receipt3Amount == null ? null : Number(r.receipt3Amount), method: r.receipt3Method, at: r.receipt3At },
      ],
    });
    const mineRow = !!me && (r.createdById === me.id || norm(canonicalManager(r.manager)) === norm(me.fullName));
    for (const c of receipts) {
      const evs = r.cashEvents.filter((e) => e.receiptNo === c.receiptNo).sort((a, b) => a.at.getTime() - b.at.getTime());
      const stage = stageOf(evs.map((e) => ({ step: e.step, toName: e.toName, at: e.at })), c.at, openFrom);
      const handedTo = evs.find((e) => e.step === "HANDED")?.toName ?? null;
      const action = nextStep(stage, { isManagerOfRow: mineRow, isSenior: amSenior, isOwner: owner, isLeader: leader });
      items.push({
        key: `${r.id}:${c.receiptNo}`,
        ledgerRowId: r.id,
        no: r.no,
        date: r.date?.toISOString() ?? null,
        manager: canonicalManager(r.manager),
        customer: r.customerName,
        receiptNo: c.receiptNo,
        amount: c.amount,
        kind: c.kind,
        at: c.at?.toISOString() ?? null,
        stage,
        handedTo,
        events: evs.map((e) => ({ step: e.step, at: e.at.toISOString(), who: e.user?.employee?.fullName ?? e.user?.email ?? null, toName: e.toName, source: e.source })),
        action,
        mine: mineRow || (amSenior && stage === "HANDED_SENIOR"),
      });
    }
  }

  const pending = (s: Stage) => s === "MANAGER" || s === "HANDED_SENIOR" || s === "HANDED_OWNER" || s === "SENIOR";
  const t = (i: CashItem) => (i.at ? new Date(i.at).getTime() : 0);
  // Менеджер — өз чектері (+ ст МОП болса, оған тапсырылғандар); басшылар — бәрі
  const visible = items.filter((i) => leader || owner || i.mine || (amSenior && (i.stage === "SENIOR" || i.stage === "HANDED_SENIOR")));
  const list = visible.filter((i) => pending(i.stage) || (t(i) >= mFrom && t(i) < mTo)).sort((a, b) => Number(pending(b.stage)) - Number(pending(a.stage)) || t(b) - t(a));

  // Санақ пен қалдық: CEO / РОП — бәрі; менеджер — тек өзіне қатысты (өз чектері, ст МОП болса — өзіне тапсырылғандар)
  const scope = leader || owner ? items : visible;
  const holders = new Map<string, number>();
  for (const i of scope) {
    const h = holderOf(i.stage, i.manager, i.handedTo, senior?.fullName ?? null);
    if (h) holders.set(h, (holders.get(h) ?? 0) + i.amount);
  }
  const ownerToday = scope
    .flatMap((i) => i.events.filter((e) => e.step === "OWNER_RECEIVED" && new Date(e.at).getTime() >= todayStart).map(() => i.amount))
    .reduce((a, b) => a + b, 0);
  const sum = (f: (i: CashItem) => boolean) => scope.filter(f).reduce((a, i) => a + i.amount, 0);

  return {
    active: !!since,
    since: since?.toISOString() ?? null,
    openFrom: openFrom?.toISOString() ?? null,
    senior,
    role: { leader, owner, senior: amSenior },
    items: list,
    kpi: {
      today: sum((i) => t(i) >= todayStart),
      todayCount: scope.filter((i) => t(i) >= todayStart).length,
      atManagers: sum((i) => i.stage === "MANAGER" || i.stage === "HANDED_SENIOR" || i.stage === "HANDED_OWNER"),
      atSenior: sum((i) => i.stage === "SENIOR"),
      ownerToday,
    },
    holders: [...holders.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    myPending: list.filter((i) => i.action !== null).length,
  };
}
export type KassaData = Awaited<ReturnType<typeof loadKassa>>;

/** Сатылым − төлем айырмасы: клиент толық төлемеген (соңғы 120 күн, қайтарылғандар есептелмейді). */
export async function loadDebts(user: SessionUser) {
  const rows = await prisma.salesLedgerRow.findMany({
    where: { soldFor: { gt: 0 }, remainder: { gt: 0 }, date: { gte: new Date(Date.now() - 120 * DAY) }, NOT: { orderStatus: { contains: "возврат", mode: "insensitive" } } },
    orderBy: { remainder: "desc" },
    take: 300,
    select: { no: true, date: true, manager: true, customerName: true, soldFor: true, remainder: true, createdById: true },
  });
  const me = user.employee;
  const all = isLeader(user);
  return rows
    .filter((r) => all || (me && (r.createdById === me.id || norm(canonicalManager(r.manager)) === norm(me.fullName))))
    .map((r) => ({ no: r.no, date: r.date?.toISOString() ?? null, manager: canonicalManager(r.manager), customer: r.customerName, soldFor: Number(r.soldFor), paid: Number(r.soldFor) - Number(r.remainder), debt: Number(r.remainder) }));
}

// ───────── әрекеттер ─────────
/** Таңдалған чектер бойынша келесі қадам (әрқайсысына рұқсат тексеріледі). to: HANDED үшін «senior» | «owner». */
export async function act(user: SessionUser, keys: string[], to: "senior" | "owner" = "senior") {
  const data = await loadKassa(user, new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 7));
  const senior = data.senior;
  const byKey = new Map(data.items.map((i) => [i.key, i]));
  const now = new Date();
  const rows: { ledgerRowId: string; receiptNo: number; step: Step; toName: string | null; amount: number; userId: string; at: Date }[] = [];
  for (const k of keys) {
    const i = byKey.get(k);
    if (!i || !i.action) continue;
    const toName = i.action === "HANDED" ? (to === "owner" ? OWNER_NAME : senior?.fullName ?? "ст МОП") : null;
    rows.push({ ledgerRowId: i.ledgerRowId, receiptNo: i.receiptNo, step: i.action, toName, amount: i.amount, userId: user.id, at: now });
    // ст МОП өз ақшасын «тапсырса» — бірден өзі қабылдаған болып саналады
    if (i.action === "HANDED" && data.role.senior && to === "senior")
      rows.push({ ledgerRowId: i.ledgerRowId, receiptNo: i.receiptNo, step: "SENIOR_RECEIVED", toName: null, amount: i.amount, userId: user.id, at: now });
  }
  if (!rows.length) throw new Error("Белгілейтін ақша жоқ немесе рұқсат жоқ");
  const r = await prisma.cashHandoverEvent.createMany({ data: rows, skipDuplicates: true });
  return { count: r.count };
}

/** «Күнді жабу»: менің қолымдағы (менің кезегім) барлық чектің келесі қадамы. */
export async function closeDay(user: SessionUser, to: "senior" | "owner" = "senior") {
  const data = await loadKassa(user, new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 7));
  const keys = data.items.filter((i) => i.action && (i.action !== "HANDED" || i.mine)).map((i) => i.key);
  if (!keys.length) throw new Error("Жабатын ақша жоқ — бәрі тапсырылған");
  return act(user, keys, to);
}

// ───────── ескі «касса» парағы ─────────
const KASSA_GID = process.env.SALES_KASSA_GID ?? "59939132";

/** Ескі парақтағы белгілерді бастапқы оқиғалар ретінде жазу (dryRun — тек санайды). Соңында Касса қосылады. */
export async function importKassaSheet(user: SessionUser, opts: { dryRun: boolean }) {
  if (!isLeader(user)) throw new Error("Тек CEO мен РОП");
  const id = process.env.SALES_SHEET_ID;
  if (!id) throw new Error("SALES_SHEET_ID орнатылмаған");
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=${KASSA_GID}`, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`«касса» парағы: Google жауабы ${res.status}`);
  const all = parseCsv(await res.text());
  const hi = all.findIndex((r) => (r[0] ?? "").trim().startsWith("Номер"));
  if (hi < 0) throw new Error("«касса» парағында тақырып табылмады");
  const sheet = all.slice(hi + 1).filter((r) => /^\d+$/.test((r[0] ?? "").trim()));

  const nos = [...new Set(sheet.map((r) => Number(r[0].trim())))];
  const ledger = await prisma.salesLedgerRow.findMany({ where: { importKey: { in: nos.map((n) => `excel:${n}`) } } });
  const byNo = new Map(ledger.map((l) => [l.no, l]));
  const money = (v: string | undefined) => {
    const n = Number((v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const stats = { rows: sheet.length, matched: 0, notFound: 0, events: 0, handed: 0, seniorOk: 0, ownerOk: 0 };
  const data: { ledgerRowId: string; receiptNo: number; step: Step; toName: string | null; amount: number | null; at: Date; source: string }[] = [];
  for (const r of sheet) {
    const l = byNo.get(Number(r[0].trim()));
    if (!l) {
      stats.notFound++;
      continue;
    }
    stats.matched++;
    const cash = cashReceipts({
      soldFor: l.soldFor == null ? null : Number(l.soldFor),
      date: l.date,
      receipts: [
        { no: 1, amount: l.receipt1Amount == null ? null : Number(l.receipt1Amount), method: l.receipt1Method, at: l.receipt1At },
        { no: 2, amount: l.receipt2Amount == null ? null : Number(l.receipt2Amount), method: l.receipt2Method, at: l.receipt2At },
        { no: 3, amount: l.receipt3Amount == null ? null : Number(l.receipt3Amount), method: l.receipt3Method, at: l.receipt3At },
      ],
    });
    const amount = money(r[11]) ?? money(r[7]) ?? money(r[8]) ?? money(r[9]);
    const d = parseSheetDate(r[10]);
    const saleDay = parseSheetDate(r[1]);
    const at = d.ok ? d.value : l.date ?? (saleDay.ok ? saleDay.value : new Date());
    const evs = eventsFromSheet({ givenTo: r[12] ?? "", seniorOk: (r[13] ?? "").trim().toUpperCase() === "TRUE", ownerOk: (r[14] ?? "").trim().toUpperCase() === "TRUE", at });
    const receiptNo = matchReceiptNo(cash, amount);
    for (const e of evs) {
      data.push({ ledgerRowId: l.id, receiptNo, step: e.step, toName: e.toName, amount, at: e.at, source: "sheet" });
      stats.events++;
      if (e.step === "HANDED") stats.handed++;
      if (e.step === "SENIOR_RECEIVED") stats.seniorOk++;
      if (e.step === "OWNER_RECEIVED") stats.ownerOk++;
    }
  }
  let written = 0;
  if (!opts.dryRun) {
    for (let i = 0; i < data.length; i += 1000) written += (await prisma.cashHandoverEvent.createMany({ data: data.slice(i, i + 1000), skipDuplicates: true })).count;
    if (!(await kassaActiveSince()))
      await prisma.appSetting.upsert({ where: { key: K_ACTIVE }, update: {}, create: { key: K_ACTIVE, value: new Date().toISOString() } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "IMPORT", entityType: "CashHandoverEvent", entityId: "kassa-sheet", newValue: { ...stats, written } } });
  }
  return { ...stats, written, dryRun: opts.dryRun };
}

export const _STAGE_LABEL = STAGE_LABEL;
