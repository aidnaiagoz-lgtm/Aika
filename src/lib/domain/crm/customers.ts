import { prisma, PermissionAction, type CustomerSegment } from "@/lib/db";
import { assertPermission, scopeWhere } from "@/lib/rbac";
import type { ActingUser } from "./types";

export interface CustomerFilters {
  search?: string;
  segment?: CustomerSegment;
  vipOnly?: boolean;
  inactiveOnly?: boolean;
  missingNpsOnly?: boolean;
}

export async function listCustomers(user: ActingUser, filters: CustomerFilters = {}) {
  const scope = assertPermission(user, "customers", PermissionAction.VIEW);
  const where: Record<string, unknown> = { ...scopeWhere(user, scope, {}) };

  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search } },
    ];
  }
  if (filters.segment) where.segment = filters.segment;
  if (filters.vipOnly) where.isVip = true;
  if (filters.inactiveOnly) where.isInactive = true;
  if (filters.missingNpsOnly) where.npsScore = null;

  return prisma.customer.findMany({
    where,
    include: {
      cars: true,
      _count: { select: { deals: true, leads: true } },
      deals: { where: { stage: "WON" }, select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerDetail(user: ActingUser, customerId: string) {
  assertPermission(user, "customers", PermissionAction.VIEW);
  return prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    include: {
      contacts: true,
      cars: true,
      leads: { orderBy: { createdAt: "desc" } },
      deals: {
        include: { assignedTo: true, car: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function updateCustomerSegment(user: ActingUser, customerId: string, segment: CustomerSegment) {
  assertPermission(user, "customers", PermissionAction.EDIT);
  const customer = await prisma.customer.update({ where: { id: customerId }, data: { segment } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "EDIT", entityType: "Customer", entityId: customerId, newValue: { segment } },
  });
  return customer;
}

export async function setCustomerVip(user: ActingUser, customerId: string, isVip: boolean) {
  assertPermission(user, "customers", PermissionAction.EDIT);
  const customer = await prisma.customer.update({ where: { id: customerId }, data: { isVip } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "EDIT", entityType: "Customer", entityId: customerId, newValue: { isVip } },
  });
  return customer;
}

export async function setCustomerInactive(user: ActingUser, customerId: string, isInactive: boolean) {
  assertPermission(user, "customers", PermissionAction.EDIT);
  const customer = await prisma.customer.update({ where: { id: customerId }, data: { isInactive } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "EDIT", entityType: "Customer", entityId: customerId, newValue: { isInactive } },
  });
  return customer;
}

export async function setCustomerNps(user: ActingUser, customerId: string, npsScore: number) {
  assertPermission(user, "customers", PermissionAction.EDIT);
  const customer = await prisma.customer.update({ where: { id: customerId }, data: { npsScore } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "EDIT", entityType: "Customer", entityId: customerId, newValue: { npsScore } },
  });
  return customer;
}

export async function addCustomerContact(user: ActingUser, customerId: string, input: { channel: string; value: string }) {
  assertPermission(user, "customers", PermissionAction.EDIT);
  return prisma.customerContact.create({ data: { customerId, channel: input.channel, value: input.value } });
}

export async function addCustomerCar(
  user: ActingUser,
  customerId: string,
  input: { make: string; model: string; year?: number }
) {
  assertPermission(user, "customers", PermissionAction.EDIT);
  return prisma.customerCar.create({
    data: { customerId, make: input.make, model: input.model, year: input.year },
  });
}
