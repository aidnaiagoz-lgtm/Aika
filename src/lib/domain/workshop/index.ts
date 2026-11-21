import "server-only";
import { Prisma, type WorkshopJob, type WorkshopJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isTestName } from "@/lib/domain/sales-ledger/test-mode";
import { canOpenWorkshop, isInstallerOnly, isLeader, isTestAccount, INSTALLER_ROLES, WORKSHOP_ROLES } from "@/lib/access";
import { isChecked } from "@/lib/domain/sales-ledger/sheet-layout";
import type { SessionUser } from "@/lib/session";
import { sendPushToUsers } from "@/lib/push";
import { materialIdsByCode, photoUrlsByCode } from "@/lib/domain/warehouse/stock";
import { splitMaterial } from "./calc";
import { computePay, DEFAULT_RATES, DEFAULT_WORKERS, jobHeadline, OPERATION_FIELD, OPERATIONS, type Operation } from "./calc";

export class WorkshopError extends Error {}

const ACTIVE_KEY = "workshop.activeSince";

function assertAccess(user: SessionUser) {
  if (!canOpenWorkshop(user)) throw new WorkshopError("Цех беттері тек цех жауаптысы мен басшыларға ашық");
}

/**
 * Тест тапсырмалары (менеджері «… тест»): тест аккаунт ТЕК соларды көреді, цех пен басшы оларды көрмейді (CEO, 2026-11-21).
 */
const TEST_JOB: Prisma.WorkshopJobWhereInput = {
  OR: [{ manager: { contains: "тест", mode: "insensitive" } }, { manager: { contains: "test", mode: "insensitive" } }],
};
const NOT_TEST_JOB: Prisma.WorkshopJobWhereInput = { NOT: TEST_JOB };
function jobScope(user: SessionUser): Prisma.WorkshopJobWhereInput {
  return isTestAccount(user) ? TEST_JOB : NOT_TEST_JOB;
}
/** Әрекет алдында: тапсырма осы қолданушының көрінісіне жата ма */
async function assertJobInScope(user: SessionUser, id: string) {
  const ok = await prisma.workshopJob.count({ where: { AND: [{ id }, jobScope(user)] } });
  if (!ok) throw new WorkshopError("Тапсырма табылмады");
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
  leatherPipingThread?: string | null;
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
    leatherPipingThread: r.leatherPipingThread ?? null,
    matType: r.matType,
    matThread: r.matThread,
    matPiping: r.matPiping,
    pocketsPairs: r.pocketsPairs == null ? null : new Prisma.Decimal(r.pocketsPairs),
  };
}

const LEDGER_SELECT = {
  id: true, no: true, date: true, createdAt: true, manager: true, car: true, brand: true, carYear: true, workshop: true,
  product: true, leatherType: true, leatherThread: true, leatherPiping: true, leatherPipingThread: true, matType: true, matThread: true, matPiping: true,
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
  // Тест тапсырмасы — цехқа (Бекзатқа) хабар бармайды, тек тест аккаунттың өзіне
  const recipients = isTestName(job.manager)
    ? await prisma.user.findMany({ where: { status: "ACTIVE", employee: { fullName: { equals: (job.manager ?? "").trim(), mode: "insensitive" } } }, select: { id: true } })
    : await prisma.user.findMany({
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
  await sendPushToUsers(recipients.map((u) => u.id), { title, body, url: `/workshop?job=${job.id}`, tag: `job-${job.id}` }).catch((e) =>
    console.error("[workshop] push", e instanceof Error ? e.message : e),
  );
  return true;
}

// ---------- тізім және әрекеттер ----------

export type JobView = "all" | "new" | "work" | "done";

const DONE_DAYS = 14;
/** CEO жапқан ескі тапсырмалардың белгісі (handedBy) — «Дайын» тізімі мен айлыққа кірмейді. */
export const ARCHIVED_BY = "Архив (CEO жапты)";
const notArchived: Prisma.WorkshopJobWhereInput = { OR: [{ handedBy: null }, { handedBy: { not: ARCHIVED_BY } }] };

/** Тапсырмалар тізімі. «all» — жаңа + жасалып жатқан + соңғы 14 күнде дайын болғандар. q — №, көлік, тауар, менеджер. */
export async function listJobs(user: SessionUser, view: JobView, q?: string) {
  assertAccess(user);
  const doneSince = new Date(Date.now() - DONE_DAYS * 86400_000);
  const byView: Prisma.WorkshopJobWhereInput =
    view === "new"
      ? { status: "NEW" }
      : view === "work"
        ? { status: "IN_PROGRESS" }
        : view === "done"
          ? { status: "DONE", doneAt: { gte: doneSince }, AND: [notArchived] }
          : { OR: [{ status: { in: ["NEW", "IN_PROGRESS"] } }, { status: "DONE", doneAt: { gte: doneSince }, AND: [notArchived] }] };
  const text = (q ?? "").trim().slice(0, 60);
  const search: Prisma.WorkshopJobWhereInput | null = text
    ? {
        OR: [
          { orderNo: { contains: text.replace(/^№\s*/, "") } },
          { car: { contains: text, mode: "insensitive" } },
          { brand: { contains: text, mode: "insensitive" } },
          { product: { contains: text, mode: "insensitive" } },
          { manager: { contains: text, mode: "insensitive" } },
        ],
      }
    : null;
  return prisma.workshopJob.findMany({
    where: { AND: [byView, jobScope(user), ...(search ? [search] : [])] },
    include: { ledgerRow: { select: { pickupMethod: true } } },
    orderBy: view === "done" ? { doneAt: "desc" } : { receivedAt: "asc" },
    take: 300,
  });
}

export async function jobCounts(user: SessionUser) {
  assertAccess(user);
  const rows = await prisma.workshopJob.groupBy({ by: ["status"], where: jobScope(user), _count: { _all: true } });
  const c = Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<WorkshopJobStatus, number>>;
  const doneRecent = await prisma.workshopJob.count({
    where: { status: "DONE", doneAt: { gte: new Date(Date.now() - DONE_DAYS * 86400_000) }, AND: [notArchived, jobScope(user)] },
  });
  return { all: (c.NEW ?? 0) + (c.IN_PROGRESS ?? 0) + doneRecent, new: c.NEW ?? 0, work: c.IN_PROGRESS ?? 0, done: doneRecent };
}

export interface JobPatch {
  cutBy?: string | null;
  joinBy?: string | null;
  edgeBy?: string | null;
  bottomBy?: string | null;
  leatherMeters?: number | null;
  leatherOwner?: string | null;
  matMeters?: number | null;
  matOwner?: string | null;
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
  if ("matOwner" in patch) data.matOwner = cleanName(patch.matOwner);
  if ("lekalaNote" in patch) data.lekalaNote = cleanName(patch.lekalaNote);
  await assertJobInScope(user, id);
  const job = await prisma.workshopJob.findUnique({ where: { id } });
  if (!job) throw new WorkshopError("Тапсырма табылмады");
  // Біреу операция белгілесе — тапсырма «жасалып жатыр» болады
  const startsWork = job.status === "NEW" && OPERATIONS.some((op) => cleanName(patch[OPERATION_FIELD[op]]));
  return prisma.workshopJob.update({
    where: { id },
    data: { ...data, ...(startsWork ? { status: "IN_PROGRESS", startedAt: new Date() } : {}) },
  });
}

/** «Тігуді бастау» — тапсырма «Тігіліп жатыр»-ға өтеді, менеджерге хабар барады. */
export async function startJob(user: SessionUser, id: string) {
  assertAccess(user);
  await assertJobInScope(user, id);
  const r = await prisma.workshopJob.updateMany({ where: { id, status: "NEW" }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  if (r.count === 0) return;
  const job = await prisma.workshopJob.findUnique({ where: { id } });
  if (job) await notifyManager(job, "started").catch((e) => console.error("[workshop] notify manager", e instanceof Error ? e.message : e));
}

/** «Дайын» алдында не толмай тұр (бос болса — дайын деуге болады). Бекзат реестрді толық толтыруы керек (CEO, 2026-11-17). */
export function missingForDone(job: Pick<WorkshopJob, "leatherType" | "leatherMeters" | "matType" | "matMeters" | "cutBy" | "joinBy">): string[] {
  const miss: string[] = [];
  if (job.leatherType && job.leatherMeters == null) miss.push("кожа расходы (метр)");
  if (!job.leatherType && job.matType && job.matMeters == null) miss.push("съёмный расходы (метр)");
  if (!job.cutBy) miss.push("резка — кім кесті");
  if (job.leatherType && !job.joinBy) miss.push("стыковка — кім тікті");
  return miss;
}

/** «Дайын»: метр мен шеберлер толуы керек; менеджерге хабар (телефонға да). */
export async function finishJob(user: SessionUser, id: string) {
  assertAccess(user);
  await assertJobInScope(user, id);
  const job = await prisma.workshopJob.findUnique({ where: { id } });
  if (!job) throw new WorkshopError("Тапсырма табылмады");
  if (job.status === "DONE") return job;
  const miss = missingForDone(job);
  if (miss.length) throw new WorkshopError(`Алдымен толтырыңыз: ${miss.join(", ")}`);
  const done = await prisma.workshopJob.update({
    where: { id },
    data: {
      status: "DONE",
      doneAt: new Date(),
      startedAt: job.startedAt ?? new Date(),
      ...(job.leatherType && job.leatherOwner == null ? { leatherOwner: "Өзіміздікі" } : {}),
      ...(job.matType && job.matMeters != null && job.matOwner == null ? { matOwner: "Өзіміздікі" } : {}),
    },
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "WORKSHOP_DONE", entityType: "WorkshopJob", entityId: id } });
  await notifyManager(done, "done").catch((e) => console.error("[workshop] notify manager", e instanceof Error ? e.message : e));
  await notifyInstallers(done).catch((e) => console.error("[workshop] notify installers", e instanceof Error ? e.message : e));
  return done;
}

/** Қате басылса: «Дайын»-нан қайтару. */
export async function reopenJob(user: SessionUser, id: string) {
  assertAccess(user);
  await assertJobInScope(user, id);
  await prisma.workshopJob.updateMany({ where: { id, status: "DONE" }, data: { status: "IN_PROGRESS", doneAt: null } });
}

/** Менеджерге хабар: сайттағы қоңырау + телефонға (Web Push). Клиенттің аты/телефоны жазылмайды. */
async function notifyManager(job: WorkshopJob, kind: "started" | "done") {
  if (!job.manager) return;
  const emp = await prisma.employee.findFirst({
    where: { fullName: { equals: job.manager.trim(), mode: "insensitive" } },
    select: { userId: true },
  });
  if (!emp?.userId) return;
  const title = kind === "started" ? `✂️ №${job.orderNo} тігу басталды` : `✅ №${job.orderNo} дайын — клиентке хабарлаңыз`;
  const body = jobHeadline(job);
  const url = kind === "started" ? "/orders/sewing" : "/orders/ready";
  await prisma.notification.create({
    data: { recipientId: emp.userId, type: `workshop.${kind}`, level: "INFO", title, body, payload: { jobId: job.id, url } },
  });
  await sendPushToUsers([emp.userId], { title, body, url, tag: `job-${job.id}-${kind}` });
}

/** Тапсырманың толық беті: тапсырма + заказдағы алып кету/түсініктеме (клиенттің аты мен телефонынсыз). */
export async function getJobDetail(user: SessionUser, id: string) {
  assertAccess(user);
  const job = await prisma.workshopJob.findFirst({
    where: { AND: [{ id }, jobScope(user)] },
    include: {
      ledgerRow: {
        select: {
          pickupMethod: true,
          pocketsLogo: true,
          orderItems: { take: 1, select: { comment: true, order: { select: { comment: true, pickupMethod: true, deadline: true } } } },
        },
      },
    },
  });
  if (!job) return null;
  const item = job.ledgerRow?.orderItems[0];
  const codes = [job.leatherType, job.leatherThread, job.leatherPiping, job.leatherPipingThread, job.matType, job.matThread, job.matPiping]
    .map((v) => splitMaterial(v)?.code ?? "")
    .filter(Boolean);
  const [photos, ids] = await Promise.all([
    photoUrlsByCode(codes).catch(() => new Map<string, string>()),
    materialIdsByCode(codes).catch(() => new Map<string, string>()),
  ]);
  return {
    job,
    photos: Object.fromEntries(photos) as Record<string, string>,
    /** Код → материал id: фотосы жоқ материалға цех осы жерден фото қоса алады */
    materialIds: Object.fromEntries(ids) as Record<string, string>,
    pickup: item?.order.pickupMethod ?? job.ledgerRow?.pickupMethod ?? null,
    deadline: item?.order.deadline ?? null,
    comment: [item?.order.comment, item?.comment].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ") || null,
    pocketsLogo: job.ledgerRow?.pocketsLogo ?? null,
  };
}

/**
 * CEO: цех жүйесі іске қосылғаннан бері «Жаңа»/«Тігіліп жатыр» күйінде қалып қойған ескі тапсырмаларды жабу
 * (Бекзат батырманы баспаған — олар іс жүзінде әлдеқашан тігілген). Ештеңе өшірілмейді: «Дайын» + «берілді» белгісі
 * қойылады, сондықтан ешбір тізімде шықпайды. `before` — осы уақытқа дейін түскендері ғана.
 */
export async function closeStaleJobs(actor: SessionUser, before: Date) {
  if (!isLeader(actor)) throw new WorkshopError("Тек CEO жаба алады");
  const stale = await prisma.workshopJob.findMany({
    where: { status: { in: ["NEW", "IN_PROGRESS"] }, receivedAt: { lt: before }, ...NOT_TEST_JOB },
    select: { id: true, receivedAt: true },
  });
  const now = new Date();
  for (const j of stale) {
    await prisma.workshopJob.updateMany({
      where: { id: j.id, status: { in: ["NEW", "IN_PROGRESS"] } },
      data: { status: "DONE", doneAt: j.receivedAt, handedAt: now, handedBy: ARCHIVED_BY },
    });
  }
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "WORKSHOP_CLOSE_STALE", entityType: "WorkshopJob", entityId: "bulk", newValue: { count: stale.length, before: before.toISOString() } },
  });
  return stale.length;
}

/** Бүгінгі күннің басы (Алматы, UTC+5). */
export function almatyTodayStart(now = Date.now()) {
  return new Date(new Date(now + 5 * 3600_000).toISOString().slice(0, 10) + "T00:00:00+05:00");
}

export async function staleJobCount(before: Date = almatyTodayStart()) {
  return prisma.workshopJob.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] }, receivedAt: { lt: before }, ...NOT_TEST_JOB } });
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
      where: { status: "DONE", doneAt: { gte: from, lt: to }, AND: [notArchived, NOT_TEST_JOB] }, // тест тапсырмалары айлыққа кірмейді
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

// ---------- орнатушылар (Расул, Берекет) — «Алып кету» (CEO, 2026-11-21) ----------

/** «Установка» заказы ғана орнатушы арқылы өтеді; «өзі алып кетеді», почта, такси т.б. — бірден менеджер береді. */
export const needsInstaller = (pickup: string | null | undefined) => /установ/i.test(pickup ?? "");
const INSTALL_WHERE: Prisma.WorkshopJobWhereInput = { ledgerRow: { pickupMethod: { contains: "установ", mode: "insensitive" } } };
const INSTALL_DAYS = 14;

function assertInstallAccess(user: SessionUser) {
  if (!(isInstallerOnly(user) || isLeader(user) || isTestAccount(user) || canOpenWorkshop(user)))
    throw new WorkshopError("«Алып кету» беті тек орнатушыларға ашық");
}

/** «Дайын» болғанда — орнатушыларға хабар (телефонға да). Тест тапсырмасы — тек тест аккаунтқа. Клиент аты/телефоны жоқ. */
async function notifyInstallers(job: WorkshopJob) {
  const row = job.ledgerRowId ? await prisma.salesLedgerRow.findUnique({ where: { id: job.ledgerRowId }, select: { pickupMethod: true } }) : null;
  if (!needsInstaller(row?.pickupMethod)) return;
  const recipients = isTestName(job.manager)
    ? await prisma.user.findMany({ where: { status: "ACTIVE", employee: { fullName: { equals: (job.manager ?? "").trim(), mode: "insensitive" } } }, select: { id: true } })
    : await prisma.user.findMany({ where: { status: "ACTIVE", userRoles: { some: { role: { name: { in: [...INSTALLER_ROLES] } } } } }, select: { id: true } });
  if (!recipients.length) return;
  const title = `✅ №${job.orderNo} дайын — алып кетіңіз`;
  const body = jobHeadline(job);
  await prisma.notification.createMany({
    data: recipients.map((u) => ({ recipientId: u.id, type: "install.ready", title, body, payload: { jobId: job.id, url: "/install" } })),
  });
  await sendPushToUsers(recipients.map((u) => u.id), { title, body, url: "/install", tag: `install-${job.id}` });
}

/** Орнатушының тізімі: цехта дайын, клиентке әлі берілмеген «установка» заказдары + бүгін алынғандары. */
export async function listInstallJobs(user: SessionUser) {
  assertInstallAccess(user);
  const since = new Date(Date.now() - INSTALL_DAYS * 86400_000);
  const scope = isTestAccount(user) ? TEST_JOB : NOT_TEST_JOB;
  const jobs = await prisma.workshopJob.findMany({
    where: {
      AND: [
        INSTALL_WHERE,
        scope,
        notArchived,
        { status: "DONE", doneAt: { gte: since } },
        // күтіп тұрғандар (әлі ешкім алмаған, клиентке берілмеген) + бүгін алынғандар (клиентке берілсе де)
        { OR: [{ pickedUpAt: null, handedAt: null }, { pickedUpAt: { gte: almatyTodayStart() } }] },
      ],
    },
    orderBy: { doneAt: "desc" },
    take: 200,
  });
  return [...jobs.filter((j) => !j.pickedUpAt), ...jobs.filter((j) => j.pickedUpAt)];
}

export async function installCount(user: SessionUser) {
  const scope = isTestAccount(user) ? TEST_JOB : NOT_TEST_JOB;
  return prisma.workshopJob.count({
    where: { AND: [INSTALL_WHERE, scope, notArchived, { status: "DONE", handedAt: null, pickedUpAt: null, doneAt: { gte: new Date(Date.now() - INSTALL_DAYS * 86400_000) } }] },
  });
}

/** «Алып кеттім»: орнатушы цехтан алды → менеджерге хабар. */
export async function pickUpJob(user: SessionUser, id: string) {
  assertInstallAccess(user);
  const scope = isTestAccount(user) ? TEST_JOB : NOT_TEST_JOB;
  const job = await prisma.workshopJob.findFirst({ where: { AND: [{ id }, scope] } });
  if (!job) throw new WorkshopError("Заказ табылмады");
  if (job.status !== "DONE") throw new WorkshopError("Цех әлі бітірмеген");
  if (job.pickedUpAt) return job;
  const who = user.employee?.id
    ? (await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } }))?.fullName ?? null
    : null;
  const r = await prisma.workshopJob.updateMany({ where: { id, pickedUpAt: null }, data: { pickedUpAt: new Date(), pickedUpBy: who } });
  if (r.count === 0) return job;
  const done = await prisma.workshopJob.findUniqueOrThrow({ where: { id } });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "INSTALL_PICKUP", entityType: "WorkshopJob", entityId: id } });
  // Менеджерге: «Расул алды»
  if (done.manager) {
    const emp = await prisma.employee.findFirst({ where: { fullName: { equals: done.manager.trim(), mode: "insensitive" } }, select: { userId: true } });
    if (emp?.userId) {
      const title = `🚚 №${done.orderNo} — ${who ?? "орнатушы"} алды`;
      const body = jobHeadline(done);
      await prisma.notification.create({ data: { recipientId: emp.userId, type: "install.pickup", level: "INFO", title, body, payload: { jobId: id, url: "/orders/ready" } } });
      await sendPushToUsers([emp.userId], { title, body, url: "/orders/ready", tag: `job-${id}-pickup` }).catch(() => undefined);
    }
  }
  return done;
}
