import "server-only";
import { Prisma, type WorkshopJob, type WorkshopJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canUseWorkshop, isLeader, WORKSHOP_ROLES } from "@/lib/access";
import { isChecked } from "@/lib/domain/sales-ledger/sheet-layout";
import type { SessionUser } from "@/lib/session";
import { computePay, DEFAULT_RATES, DEFAULT_WORKERS, jobHeadline, leatherNorm, OPERATION_FIELD, OPERATIONS, type Operation } from "./calc";

export class WorkshopError extends Error {}

const ACTIVE_KEY = "workshop.activeSince";

function assertAccess(user: SessionUser) {
  if (!canUseWorkshop(user)) throw new WorkshopError("Цех беттері тек цех жауаптысы мен басшыларға ашық");
}

// ---------- іске қосу ----------

/** Цех жүйесі қай уақыттан бастап жұмыс істейді (бұрынғы сатылымдар тапсырма болып ашылмасын). */
export async function workshopActiveSince(): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: ACTIVE_KEY } });
  const d = row ? new Date(row.value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/** CEO: цехты іске қосу. `since` — осы күннен бергі «Цех ✓» сатылымдар тапсырма болады (әдепкі — бүгін). */
export async function activateWorkshop(actor: SessionUser, since?: Date) {
  if (!isLeader(actor)) throw new WorkshopError("Тек CEO іске қоса алады");
  const almatyToday = new Date(new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10) + "T00:00:00+05:00");
  const value = (since ?? almatyToday).toISOString();
  await prisma.appSetting.upsert({ where: { key: ACTIVE_KEY }, update: { value }, create: { key: ACTIVE_KEY, value } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "SETTING", entityType: "AppSetting", entityId: ACTIVE_KEY, newValue: { value } } });
  await ensureDefaultRates();
  if ((await prisma.workshopWorker.count()) === 0) {
    await prisma.workshopWorker.createMany({ data: DEFAULT_WORKERS.map((name) => ({ name })), skipDuplicates: true });
  }
  return syncWorkshopJobs();
}

// ---------- сатылым → тапсырма ----------

type LedgerLike = {
  id: string;
  no: number;
  date: Date | null;
  createdAt: Date;
  manager: string | null;
  car: string | null;
  brand: string | null;
  carYear: number | null;
  workshop: string | null;
  product: string | null;
  leatherType: string | null;
  leatherThread: string | null;
  leatherPiping: string | null;
  matType: string | null;
  matThread: string | null;
  matPiping: string | null;
  pocketsPairs: number | null;
};

function fieldsFromRow(r: LedgerLike) {
  return {
    orderNo: String(r.no),
    manager: r.manager,
    car: r.car,
    brand: r.brand,
    carYear: r.carYear,
    product: r.product,
    leatherType: r.leatherType,
    leatherThread: r.leatherThread,
    leatherPiping: r.leatherPiping,
    matType: r.matType,
    matThread: r.matThread,
    matPiping: r.matPiping,
    pocketsPairs: r.pocketsPairs == null ? null : new Prisma.Decimal(r.pocketsPairs),
  };
}

const LEDGER_SELECT = {
  id: true, no: true, date: true, createdAt: true, manager: true, car: true, brand: true, carYear: true, workshop: true,
  product: true, leatherType: true, leatherThread: true, leatherPiping: true, matType: true, matThread: true, matPiping: true,
  pocketsPairs: true, workshopJob: true,
} as const;

function sameFields(job: WorkshopJob, next: ReturnType<typeof fieldsFromRow>): boolean {
  return (Object.keys(next) as Array<keyof typeof next>).every((k) => {
    const a = job[k] as unknown, b = next[k] as unknown;
    if (a == null || b == null) return a == b;
    return String(a) === String(b);
  });
}

/**
 * «Цех ✓» сатылымдарды цех тапсырмасымен сәйкестендіреді:
 *  - жаңа «Цех ✓» → тапсырма ашылады (NEW);
 *  - тапсырма әлі NEW болса — сатылымдағы өзгерістер (көлік, тауар...) оған көшеді;
 *  - «Цех» алынып тасталса және тапсырма әлі басталмаса → CANCELLED;
 *  - көлік пен тауар толғанда цехқа бір рет хабар барады.
 * ids берілмесе — іске қосылған күннен бергі барлық жолдар тексеріледі.
 */
export async function syncWorkshopJobs(
  ids?: string[],
  opts: { recentDays?: number } = {},
): Promise<{ created: number; updated: number; cancelled: number; notified: number }> {
  const since = await workshopActiveSince();
  const res = { created: 0, updated: 0, cancelled: 0, notified: 0 };
  if (!since) return res;
  if (ids && ids.length === 0) return res;

  const rows = await prisma.salesLedgerRow.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      OR: [{ date: { gte: since } }, { date: null, createdAt: { gte: since } }],
      ...(opts.recentDays ? { updatedAt: { gte: new Date(Date.now() - opts.recentDays * 86400_000) } } : {}),
    },
    select: LEDGER_SELECT,
  });

  for (const r of rows) {
    const want = isChecked(r.workshop);
    const job = r.workshopJob;
    if (want && !job) {
      const created = await prisma.workshopJob.create({
        data: { ledgerRowId: r.id, source: "sales", receivedAt: new Date(), ...fieldsFromRow(r) },
      });
      res.created++;
      if (await maybeNotify(created)) res.notified++;
    } else if (want && job && job.status === "NEW") {
      const next = fieldsFromRow(r);
      if (sameFields(job, next)) {
        if (await maybeNotify(job)) res.notified++;
        continue;
      }
      const updated = await prisma.workshopJob.update({ where: { id: job.id }, data: next });
      res.updated++;
      if (await maybeNotify(updated)) res.notified++;
    } else if (want && job && job.status === "CANCELLED") {
      await prisma.workshopJob.update({ where: { id: job.id }, data: { status: "NEW", ...fieldsFromRow(r) } });
      res.updated++;
    } else if (!want && job && job.status === "NEW") {
      await prisma.workshopJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
      res.cancelled++;
    }
  }
  return res;
}

/** Көлік пен тауар толған кезде цехқа бір рет хабарлайды. */
async function maybeNotify(job: WorkshopJob): Promise<boolean> {
  if (job.notifiedAt || job.status !== "NEW") return false;
  if (!(job.car || job.brand) || !job.product) return false;
  const claimed = await prisma.workshopJob.updateMany({ where: { id: job.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
  if (claimed.count === 0) return false;
  const recipients = await prisma.user.findMany({
    where: { status: "ACTIVE", userRoles: { some: { role: { name: { in: [...WORKSHOP_ROLES] } } } } },
    select: { id: true },
  });
  const title = `Жаңа тапсырма №${job.orderNo}`;
  const body = jobHeadline(job);
  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((u) => ({ recipientId: u.id, type: "workshop.new", title, body, payload: { jobId: job.id, url: "/workshop" } })),
    });
  }
  if (notifyHook) {
    await notifyHook(recipients.map((u) => u.id), { title, body, url: `/workshop?job=${job.id}` }).catch((e) =>
      console.error("[workshop] push", e instanceof Error ? e.message : e),
    );
  }
  return true;
}

/** 1b-кезең: телефонға push — sendPush осында тіркеледі (тәуелділік циклі болмас үшін). */
type NotifyHook = (userIds: string[], msg: { title: string; body: string; url: string }) => Promise<void>;
let notifyHook: NotifyHook | null = null;
export function setWorkshopNotifyHook(fn: NotifyHook) {
  notifyHook = fn;
}

// ---------- тізім және әрекеттер ----------

export type JobView = "new" | "work" | "done";

export async function listJobs(user: SessionUser, view: JobView) {
  assertAccess(user);
  const status: WorkshopJobStatus[] = view === "new" ? ["NEW"] : view === "work" ? ["IN_PROGRESS"] : ["DONE"];
  return prisma.workshopJob.findMany({
    where: {
      status: { in: status },
      ...(view === "done" ? { doneAt: { gte: new Date(Date.now() - 14 * 86400_000) } } : {}),
    },
    orderBy: view === "done" ? { doneAt: "desc" } : { receivedAt: "asc" },
    take: 300,
  });
}

export async function jobCounts(user: SessionUser) {
  assertAccess(user);
  const rows = await prisma.workshopJob.groupBy({ by: ["status"], _count: { _all: true } });
  const c = Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<WorkshopJobStatus, number>>;
  const doneRecent = await prisma.workshopJob.count({ where: { status: "DONE", doneAt: { gte: new Date(Date.now() - 14 * 86400_000) } } });
  return { new: c.NEW ?? 0, work: c.IN_PROGRESS ?? 0, done: doneRecent };
}

export interface JobPatch {
  cutBy?: string | null;
  joinBy?: string | null;
  edgeBy?: string | null;
  bottomBy?: string | null;
  leatherMeters?: number | null;
  leatherOwner?: string | null;
  matMeters?: number | null;
  lekalaNote?: string | null;
}

function cleanName(v: string | null | undefined) {
  const s = (v ?? "").trim();
  return s ? s.slice(0, 60) : null;
}

function cleanMeters(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return null;
  if (v < 0 || v > 50) throw new WorkshopError("Метр 0–50 аралығында болуы керек");
  return new Prisma.Decimal(Math.round(v * 100) / 100);
}

export async function updateJob(user: SessionUser, id: string, patch: JobPatch) {
  assertAccess(user);
  const data: Prisma.WorkshopJobUpdateInput = {};
  for (const op of OPERATIONS) {
    const f = OPERATION_FIELD[op];
    if (f in patch) data[f] = cleanName(patch[f]);
  }
  if ("leatherMeters" in patch) data.leatherMeters = cleanMeters(patch.leatherMeters);
  if ("matMeters" in patch) data.matMeters = cleanMeters(patch.matMeters);
  if ("leatherOwner" in patch) data.leatherOwner = cleanName(patch.leatherOwner);
  if ("lekalaNote" in patch) data.lekalaNote = cleanName(patch.lekalaNote);
  const job = await prisma.workshopJob.findUnique({ where: { id } });
  if (!job) throw new WorkshopError("Тапсырма табылмады");
  // Біреу операция белгілесе — тапсырма «жасалып жатыр» болады
  const startsWork = job.status === "NEW" && OPERATIONS.some((op) => cleanName(patch[OPERATION_FIELD[op]]));
  return prisma.workshopJob.update({
    where: { id },
    data: { ...data, ...(startsWork ? { status: "IN_PROGRESS", startedAt: new Date() } : {}) },
  });
}

export async function startJob(user: SessionUser, id: string) {
  assertAccess(user);
  await prisma.workshopJob.updateMany({ where: { id, status: "NEW" }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
}

/** «Дайын»: кем дегенде резка белгіленуі керек; былғары метрі бос болса — норма қойылады; менеджерге хабар. */
export async function finishJob(user: SessionUser, id: string) {
  assertAccess(user);
  const job = await prisma.workshopJob.findUnique({ where: { id } });
  if (!job) throw new WorkshopError("Тапсырма табылмады");
  if (job.status === "DONE") return job;
  if (!job.cutBy) throw new WorkshopError("Алдымен «Резка кожи» кім жасағанын белгілеңіз");
  const norm = leatherNorm(job.product);
  const done = await prisma.workshopJob.update({
    where: { id },
    data: {
      status: "DONE",
      doneAt: new Date(),
      startedAt: job.startedAt ?? new Date(),
      ...(job.leatherMeters == null && norm != null ? { leatherMeters: new Prisma.Decimal(norm) } : {}),
      ...(job.leatherOwner == null ? { leatherOwner: "Өзіміздікі" } : {}),
    },
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "WORKSHOP_DONE", entityType: "WorkshopJob", entityId: id } });
  await notifyManagerDone(done).catch((e) => console.error("[workshop] notify manager", e instanceof Error ? e.message : e));
  return done;
}

/** Қате басылса: «Дайын»-нан қайтару. */
export async function reopenJob(user: SessionUser, id: string) {
  assertAccess(user);
  await prisma.workshopJob.updateMany({ where: { id, status: "DONE" }, data: { status: "IN_PROGRESS", doneAt: null } });
}

async function notifyManagerDone(job: WorkshopJob) {
  if (!job.manager) return;
  const emp = await prisma.employee.findFirst({
    where: { fullName: { equals: job.manager.trim(), mode: "insensitive" } },
    select: { userId: true },
  });
  if (!emp?.userId) return;
  await prisma.notification.create({
    data: {
      recipientId: emp.userId,
      type: "workshop.done",
      level: "INFO",
      title: `№${job.orderNo} дайын — клиентке хабарлаңыз`,
      body: jobHeadline(job),
      payload: { jobId: job.id, url: "/departments/sales/almaty" },
    },
  });
}

// ---------- қызметкерлер мен бағалар ----------

export async function listWorkers(user: SessionUser, includeInactive = false) {
  assertAccess(user);
  return prisma.workshopWorker.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { name: "asc" } });
}

export async function addWorker(user: SessionUser, name: string) {
  assertAccess(user);
  const n = cleanName(name);
  if (!n) throw new WorkshopError("Атын жазыңыз");
  return prisma.workshopWorker.upsert({ where: { name: n }, update: { active: true }, create: { name: n } });
}

export async function setWorkerActive(user: SessionUser, id: string, active: boolean) {
  assertAccess(user);
  return prisma.workshopWorker.update({ where: { id }, data: { active } });
}

export async function ensureDefaultRates() {
  const count = await prisma.workshopRate.count();
  if (count > 0) return;
  await prisma.workshopRate.createMany({
    data: OPERATIONS.map((op) => ({ operation: op, price: new Prisma.Decimal(DEFAULT_RATES[op]), validFrom: new Date("2025-01-01T00:00:00+05:00") })),
  });
}

export async function currentRates(): Promise<Record<Operation, number>> {
  const rates = await prisma.workshopRate.findMany({ orderBy: { validFrom: "desc" } });
  const out = { ...DEFAULT_RATES };
  for (const op of OPERATIONS) {
    const r = rates.find((x) => x.operation === op && x.validFrom.getTime() <= Date.now());
    if (r) out[op] = Number(r.price);
  }
  return out;
}

/** Тек CEO: жаңа баға (бүгіннен бастап). Ескі айлар ескі бағамен қалады. */
export async function setRate(actor: SessionUser, op: Operation, price: number) {
  if (!isLeader(actor)) throw new WorkshopError("Бағаны тек CEO өзгерте алады");
  if (!OPERATIONS.includes(op) || !(price >= 0 && price <= 1_000_000)) throw new WorkshopError("Баға дұрыс емес");
  await ensureDefaultRates();
  await prisma.workshopRate.create({ data: { operation: op, price: new Prisma.Decimal(price), validFrom: new Date() } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "SETTING", entityType: "WorkshopRate", entityId: op, newValue: { price } } });
}

// ---------- айлық есебі ----------

export async function payReport(user: SessionUser, from: Date, to: Date) {
  assertAccess(user);
  const [jobs, rates] = await Promise.all([
    prisma.workshopJob.findMany({
      where: { status: "DONE", doneAt: { gte: from, lt: to } },
      select: { doneAt: true, cutBy: true, joinBy: true, edgeBy: true, bottomBy: true, leatherMeters: true, leatherOwner: true },
    }),
    prisma.workshopRate.findMany(),
  ]);
  const pay = computePay(jobs, rates.map((r) => ({ operation: r.operation, price: Number(r.price), validFrom: r.validFrom })));
  const leatherOwn = jobs.reduce((s, j) => s + (j.leatherOwner && j.leatherOwner !== "Өзіміздікі" ? 0 : Number(j.leatherMeters ?? 0)), 0);
  return { ...pay, leatherOwnMeters: Math.round(leatherOwn * 100) / 100 };
}

/** «Продажи» бетіне: сатылым id → цех статусы. */
export async function workshopStatusByLedger(ids: string[]) {
  if (ids.length === 0) return new Map<string, WorkshopJobStatus>();
  const jobs = await prisma.workshopJob.findMany({ where: { ledgerRowId: { in: ids } }, select: { ledgerRowId: true, status: true } });
  return new Map(jobs.filter((j) => j.ledgerRowId).map((j) => [j.ledgerRowId as string, j.status]));
}
