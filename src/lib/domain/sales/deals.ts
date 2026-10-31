import { prisma, PermissionAction, type DealStage, type Prisma } from "@/lib/db";
import { assertPermission, scopeWhere } from "@/lib/rbac";
import { publish } from "@/lib/events";
import { createOrderFromDeal, recordFullPayment } from "@/lib/domain/orders";
import type { ActingUser } from "./types";

// §7 pipeline: New Lead → Contacted → Qualified → Offer → Order → Paid → Won/Lost.
// Lead-тегі алғашқы екі саты Lead моделінде (§ leads.ts) өтеді, Deal QUALIFIED-тен басталады.
// OFFER→ORDER және ORDER→PAID жалпы advanceDealStage арқылы емес — тауар/қызмет құрамын
// (Order) және төлемді (Payment) де жасайтын арнайы функциялар арқылы өтеді (§9, §15).
const SIMPLE_FORWARD: Partial<Record<DealStage, DealStage>> = {
  QUALIFIED: "OFFER",
  PAID: "WON",
};
const CAN_LOSE: DealStage[] = ["QUALIFIED", "OFFER", "ORDER", "PAID"];

export interface DealFilters {
  search?: string;
  stage?: string;
  assignedToId?: string;
}

export async function listDeals(user: ActingUser, filters: DealFilters = {}) {
  const scope = assertPermission(user, "deals", PermissionAction.VIEW);
  const where: Prisma.DealWhereInput = scopeWhere(user, scope, { ownerField: "assignedToId", branchField: "branchId" });
  if (filters.stage) where.stage = filters.stage as never;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.search) {
    where.customer = {
      OR: [
        { fullName: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search } },
      ],
    };
  }
  return prisma.deal.findMany({
    where,
    include: { customer: true, car: true, assignedTo: true, discountRequests: { where: { status: "PENDING" } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getDeal(user: ActingUser, dealId: string) {
  assertPermission(user, "deals", PermissionAction.VIEW);
  return prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: {
      customer: true,
      car: true,
      assignedTo: true,
      stageHistory: { include: { changedBy: true }, orderBy: { changedAt: "asc" } },
      discountRequests: { include: { requestedBy: true, approvedBy: true }, orderBy: { createdAt: "desc" } },
      order: true,
      sourceLead: true,
    },
  });
}

export async function getDealAuditLog(user: ActingUser, dealId: string) {
  assertPermission(user, "deals", PermissionAction.VIEW);
  return prisma.auditLog.findMany({
    where: { entityType: "Deal", entityId: dealId },
    include: { actor: { include: { employee: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Мәміле сомасын тек Order жасалғанға дейін (QUALIFIED/OFFER) қолмен түзетуге болады —
 *  ORDER сатысынан бастап сома Order-дан есептеледі (§9). */
export async function updateDealAmount(user: ActingUser, dealId: string, amount: number) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  if (amount < 0) throw new Error("Сома теріс болмауы керек");
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (!["QUALIFIED", "OFFER"].includes(deal.stage)) {
    throw new Error(`"${deal.stage}" сатысында сома тек Order арқылы өзгереді`);
  }
  const updated = await prisma.deal.update({ where: { id: dealId }, data: { amount } });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "EDIT",
      entityType: "Deal",
      entityId: dealId,
      oldValue: { amount: Number(deal.amount) },
      newValue: { amount },
    },
  });
  return updated;
}

/** ROP/CEO мәмілені басқа менеджерге қайта тағайындай алады (§30). */
export async function reassignDeal(user: ActingUser, dealId: string, assignedToId: string) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  const before = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
  const deal = await prisma.deal.update({ where: { id: dealId }, data: { assignedToId } });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "REASSIGN",
      entityType: "Deal",
      entityId: dealId,
      oldValue: { assignedToId: before.assignedToId },
      newValue: { assignedToId },
    },
  });
  return deal;
}

export async function advanceDealStage(user: ActingUser, dealId: string) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
  const nextStage = SIMPLE_FORWARD[deal.stage];
  if (!nextStage) {
    throw new Error(
      deal.stage === "OFFER" || deal.stage === "ORDER"
        ? `"${deal.stage}" сатысынан жылжу үшін тиісті әрекетті қолданыңыз (тапсырыс/төлем)`
        : `"${deal.stage}" сатысынан алға жылжу мүмкін емес`
    );
  }
  return transitionDeal(user, deal.id, deal.stage, nextStage);
}

/** OFFER → ORDER: тауар/қызмет құрамын таңдап, нақты Order жазбасын жасайды. */
export async function advanceDealToOrder(
  user: ActingUser,
  dealId: string,
  items: { productId: string; qty: number }[]
) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (deal.stage !== "OFFER") throw new Error('Тапсырыс тек "Ұсыныс жасалды" сатысынан жасалады');

  await createOrderFromDeal(user, dealId, items);
  return transitionDeal(user, deal.id, deal.stage, "ORDER");
}

/** ORDER → PAID: тапсырыс сомасын толық төленген деп белгілейді (Payment жазады). */
export async function markDealPaid(user: ActingUser, dealId: string) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { order: true } });
  if (deal.stage !== "ORDER" || !deal.order) throw new Error('Төлем тек тапсырысы бар "Тапсырыс" сатысында белгіленеді');

  await recordFullPayment(user, deal.order.id);
  return transitionDeal(user, deal.id, deal.stage, "PAID");
}

export async function markDealLost(user: ActingUser, dealId: string) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (!CAN_LOSE.includes(deal.stage)) throw new Error(`"${deal.stage}" сатысын "жоғалтылды" деп белгілеу мүмкін емес`);
  return transitionDeal(user, deal.id, deal.stage, "LOST");
}

async function transitionDeal(user: ActingUser, dealId: string, fromStage: DealStage, toStage: DealStage) {
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы мәміле сатысын өзгерте алады");

  const deal = await prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id: dealId },
      data: { stage: toStage, closedAt: toStage === "WON" || toStage === "LOST" ? new Date() : undefined },
    });
    await tx.dealStageHistory.create({
      data: { dealId, fromStage, toStage, changedById: user.employee!.id },
    });
    return updated;
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "STAGE_CHANGE",
      entityType: "Deal",
      entityId: dealId,
      oldValue: { stage: fromStage },
      newValue: { stage: toStage },
    },
  });

  publish({ type: "deal.stage_changed", dealId, fromStage, toStage });
  if (toStage === "PAID") publish({ type: "deal.paid", dealId, customerId: deal.customerId, amount: Number(deal.amount) });
  if (toStage === "WON") publish({ type: "deal.won", dealId });
  if (toStage === "LOST") publish({ type: "deal.lost", dealId });

  return deal;
}
