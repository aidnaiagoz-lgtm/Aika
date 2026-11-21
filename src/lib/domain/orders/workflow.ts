import "server-only";
import { prisma, type Prisma } from "@/lib/db";
import { isLeader } from "@/lib/access";
import type { ActingUser } from "./types";
import { formatPhone } from "./unified-calc";

/**
 * Менеджердің заказ жолы (CEO, 2026-11-17): «Тігілуде» — цехтағы заказдарым (кезекте/тігілуде, цехта қанша уақыт),
 * «Дайын» — цех бітірген, клиентке әлі берілмеген заказдарым («Берілді» батырмасы).
 * Дерек — цех тапсырмалары (WorkshopJob, әр тауар бір тапсырма) + оның Продажи жолы (клиент, қалдық).
 * Менеджер — тек өзінікі (тапсырмадағы «Менеджер» аты бойынша); басшы — бәрі немесе «Менің».
 */

type Who = "mine" | "all";
type U = ActingUser & { userRoles: Array<{ role: { name: string } }> };

/** «Дайын» тізімінде ұзақ тұрған (берілмей ұмытылған) ескі тапсырмалар шықпасын. */
const READY_DAYS = 45;

async function ownerWhere(user: U, who: Who): Promise<Prisma.WorkshopJobWhereInput> {
  if (isLeader(user) && who === "all") return {};
  const name = user.employee?.id
    ? (await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } }))?.fullName
    : null;
  return { manager: { equals: (name ?? "__none__").trim(), mode: "insensitive" } };
}

const SELECT = {
  id: true,
  orderNo: true,
  status: true,
  receivedAt: true,
  startedAt: true,
  doneAt: true,
  handedAt: true,
  handedBy: true,
  pickedUpAt: true,
  pickedUpBy: true,
  manager: true,
  car: true,
  brand: true,
  carYear: true,
  product: true,
  leatherType: true,
  ledgerRow: { select: { customerName: true, phoneNorm: true, customerPhone: true, remainder: true, pickupMethod: true } },
} as const;

export interface FlowRow {
  id: string;
  orderNo: string;
  status: "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  receivedAt: string;
  doneAt: string | null;
  manager: string;
  customer: string;
  phone: string;
  car: string;
  product: string;
  leather: string;
  remainder: number;
  /** Дайыннан кейінгі жол (2026-11-21) */
  needsInstaller: boolean;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  handedAt: string | null;
  handedBy: string | null;
}

function toRow(j: Prisma.WorkshopJobGetPayload<{ select: typeof SELECT }>): FlowRow {
  const car = [j.car, j.brand].map((s) => (s ?? "").trim()).filter(Boolean);
  const carText = car.length === 2 && car[1].toLowerCase().includes(car[0].toLowerCase()) ? car[1] : car.join(" ");
  return {
    id: j.id,
    orderNo: j.orderNo,
    status: j.status,
    receivedAt: j.receivedAt.toISOString(),
    doneAt: j.doneAt?.toISOString() ?? null,
    manager: j.manager ?? "",
    customer: j.ledgerRow?.customerName ?? "",
    phone: formatPhone(j.ledgerRow?.phoneNorm ?? j.ledgerRow?.customerPhone),
    car: carText + (j.carYear ? ` ${j.carYear}` : ""),
    product: (j.product ?? "").trim(),
    leather: (j.leatherType ?? "").replace(/^\d+\s*-\s*Кожа\s*-\s*/i, "").trim(),
    remainder: Math.max(0, Number(j.ledgerRow?.remainder ?? 0)),
    needsInstaller: /установ/i.test(j.ledgerRow?.pickupMethod ?? ""),
    pickedUpAt: j.pickedUpAt?.toISOString() ?? null,
    pickedUpBy: j.pickedUpBy ?? null,
    handedAt: j.handedAt?.toISOString() ?? null,
    handedBy: j.handedBy ?? null,
  };
}

const sewingWhere: Prisma.WorkshopJobWhereInput = { status: { in: ["NEW", "IN_PROGRESS"] } };
const readyWhere = (): Prisma.WorkshopJobWhereInput => ({
  status: "DONE",
  handedAt: null,
  doneAt: { gte: new Date(Date.now() - READY_DAYS * 86400_000) },
});

export async function listSewing(user: U, who: Who): Promise<FlowRow[]> {
  const jobs = await prisma.workshopJob.findMany({
    where: { AND: [sewingWhere, await ownerWhere(user, who)] },
    orderBy: { receivedAt: "asc" },
    take: 300,
    select: SELECT,
  });
  return jobs.map(toRow);
}

export async function listReady(user: U, who: Who): Promise<FlowRow[]> {
  const jobs = await prisma.workshopJob.findMany({
    where: { AND: [readyWhere(), await ownerWhere(user, who)] },
    orderBy: { doneAt: "desc" },
    take: 300,
    select: SELECT,
  });
  return jobs.map(toRow);
}

/** Мәзірдегі сандар (менеджерге — өзінікі, басшыға — бәрі). */
export async function flowCounts(user: U): Promise<{ sewing: number; ready: number }> {
  const owner = await ownerWhere(user, isLeader(user) ? "all" : "mine");
  const [sewing, ready] = await Promise.all([
    prisma.workshopJob.count({ where: { AND: [sewingWhere, owner] } }),
    prisma.workshopJob.count({ where: { AND: [readyWhere(), owner] } }),
  ]);
  return { sewing, ready };
}

export class FlowError extends Error {}

/** «Берілді»: клиент заказын алды. Менеджер — тек өз заказын; басшы — кез келгенін. */
export async function markHanded(user: U, jobId: string) {
  const job = await prisma.workshopJob.findUnique({ where: { id: jobId }, select: { id: true, status: true, manager: true, handedAt: true } });
  if (!job) throw new FlowError("Заказ табылмады");
  if (job.status !== "DONE") throw new FlowError("Цех әлі бітірмеген");
  if (!isLeader(user)) {
    const own = await prisma.workshopJob.count({ where: { AND: [{ id: jobId }, await ownerWhere(user, "mine")] } });
    if (!own) throw new FlowError("Бұл басқа менеджердің заказы");
  }
  if (job.handedAt) return;
  const name = user.employee?.id
    ? (await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } }))?.fullName
    : null;
  await prisma.workshopJob.update({ where: { id: jobId }, data: { handedAt: new Date(), handedBy: name ?? null } });
}
