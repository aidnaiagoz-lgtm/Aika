import { prisma, PermissionAction, type Prisma } from "@/lib/db";
import { assertPermission, scopeWhere } from "@/lib/rbac";
import { publish } from "@/lib/events";
import type { ActingUser } from "./types";
import { findOrCreateCustomer } from "./customers";

export interface LeadFilters {
  search?: string;
  status?: string;
  assignedToId?: string;
  includeConverted?: boolean;
}

export async function listLeads(user: ActingUser, filters: LeadFilters = {}) {
  const scope = assertPermission(user, "leads", PermissionAction.VIEW);
  const where: Prisma.LeadWhereInput = {
    ...(filters.includeConverted ? {} : { status: { not: "CONVERTED" } }),
    ...scopeWhere(user, scope, { ownerField: "assignedToId", departmentField: "departmentId" }),
  };
  if (filters.status) where.status = filters.status as never;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search } },
    ];
  }
  return prisma.lead.findMany({
    where,
    include: { assignedTo: true, customer: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLead(user: ActingUser, leadId: string) {
  assertPermission(user, "leads", PermissionAction.VIEW);
  return prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { assignedTo: true, customer: true, department: true, convertedDeal: true },
  });
}

export async function getLeadAuditLog(user: ActingUser, leadId: string) {
  assertPermission(user, "leads", PermissionAction.VIEW);
  return prisma.auditLog.findMany({
    where: { entityType: "Lead", entityId: leadId },
    include: { actor: { include: { employee: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateLead(
  user: ActingUser,
  leadId: string,
  input: { fullName?: string; phone?: string; source?: string }
) {
  assertPermission(user, "leads", PermissionAction.EDIT);
  const before = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "EDIT",
      entityType: "Lead",
      entityId: leadId,
      oldValue: { fullName: before.fullName, phone: before.phone, source: before.source },
      newValue: { fullName: lead.fullName, phone: lead.phone, source: lead.source },
    },
  });
  return lead;
}

/** §7 pipeline: NEW/CONTACTED сатысындағы лид ешқашан мәмілеге айналмаса — жоғалтылды
 *  деп белгіленеді. CONVERTED лидті жоғалтылды деп белгілеу мүмкін емес (мәміле бөлек өз
 *  жолымен жүреді — markDealLost). */
export async function markLeadLost(user: ActingUser, leadId: string, reason?: string) {
  assertPermission(user, "leads", PermissionAction.EDIT);
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.status === "CONVERTED") throw new Error("Мәмілеге айналған лидті жоғалтылды деп белгілеу мүмкін емес");
  const updated = await prisma.lead.update({ where: { id: leadId }, data: { status: "LOST" } });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "EDIT",
      entityType: "Lead",
      entityId: leadId,
      oldValue: { status: lead.status },
      newValue: { status: "LOST", reason },
    },
  });
  return updated;
}

/** ROP/CEO лидті басқа менеджерге қайта тағайындай алады (§30-мен ұқсас). */
export async function reassignLead(user: ActingUser, leadId: string, assignedToId: string) {
  assertPermission(user, "leads", PermissionAction.EDIT);
  const before = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const lead = await prisma.lead.update({ where: { id: leadId }, data: { assignedToId } });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "REASSIGN",
      entityType: "Lead",
      entityId: leadId,
      oldValue: { assignedToId: before.assignedToId },
      newValue: { assignedToId },
    },
  });
  return lead;
}

export async function listSalesEmployees() {
  return prisma.employee.findMany({
    where: { user: { userRoles: { some: { role: { name: { in: ["SALES_MANAGER", "SENIOR_SALES_MANAGER"] } } } } } },
    orderBy: { fullName: "asc" },
  });
}

export async function createLead(
  user: ActingUser,
  input: { fullName: string; phone: string; source: string }
) {
  assertPermission(user, "leads", PermissionAction.CREATE);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы лид жасай алады");

  const lead = await prisma.lead.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      source: input.source,
      assignedToId: user.employee.id,
      departmentId: user.employee.departmentId,
    },
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "CREATE", entityType: "Lead", entityId: lead.id, newValue: lead },
  });

  return lead;
}

export async function markLeadContacted(user: ActingUser, leadId: string) {
  assertPermission(user, "leads", PermissionAction.EDIT);
  const lead = await prisma.lead.update({ where: { id: leadId }, data: { status: "CONTACTED" } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "EDIT", entityType: "Lead", entityId: lead.id, newValue: { status: "CONTACTED" } },
  });
  return lead;
}

export async function convertLeadToDeal(
  user: ActingUser,
  leadId: string,
  input: { customerPhone: string; customerFullName: string; amount: number }
) {
  assertPermission(user, "leads", PermissionAction.EDIT);
  assertPermission(user, "deals", PermissionAction.CREATE);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы мәміле жасай алады");

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const customer = await findOrCreateCustomer({
    phone: input.customerPhone,
    fullName: input.customerFullName,
    source: lead.source,
  });

  const deal = await prisma.$transaction(async (tx) => {
    const created = await tx.deal.create({
      data: {
        leadId: lead.id,
        customerId: customer.id,
        amount: input.amount,
        // Мәміле лидтің бастапқы иесіне тағайындалады, конверсияны жасаған адамға емес
        // (мыс. Department Head/CEO командасы үшін жасаса да, кредит менеджерде қалады).
        assignedToId: lead.assignedToId ?? user.employee!.id,
        branchId: user.employee!.branchId,
      },
    });
    await tx.dealStageHistory.create({
      data: { dealId: created.id, fromStage: null, toStage: "QUALIFIED", changedById: user.employee!.id },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTED", convertedDealId: created.id, customerId: customer.id },
    });
    return created;
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "CONVERT", entityType: "Lead", entityId: lead.id, newValue: { dealId: deal.id } },
  });

  publish({ type: "lead.converted", leadId: lead.id, dealId: deal.id });

  return deal;
}
