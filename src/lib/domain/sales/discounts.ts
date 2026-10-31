import { prisma, PermissionAction } from "@/lib/db";
import { assertPermission } from "@/lib/rbac";
import { publish } from "@/lib/events";
import type { ActingUser } from "./types";

// §26: жеңілдік тікелей deal-ды өзгертпейді — approval workflow арқылы ғана.
export async function requestDiscount(user: ActingUser, dealId: string, requestedPct: number) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы жеңілдік сұрай алады");
  if (requestedPct <= 0 || requestedPct > 50) throw new Error("Жеңілдік 0–50% аралығында болуы керек");

  const request = await prisma.discountRequest.create({
    data: { dealId, requestedById: user.employee.id, requestedPct },
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "REQUEST", entityType: "DiscountRequest", entityId: request.id, newValue: request },
  });

  publish({ type: "discount.requested", discountRequestId: request.id, dealId, requestedPct });

  return request;
}

export async function decideDiscount(user: ActingUser, discountRequestId: string, approve: boolean) {
  assertPermission(user, "deals", PermissionAction.APPROVE);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы жеңілдікті бекіте алады");

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.discountRequest.update({
      where: { id: discountRequestId },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        approvedById: user.employee!.id,
        decidedAt: new Date(),
      },
    });
    if (approve) {
      await tx.deal.update({ where: { id: updated.dealId }, data: { discountPct: updated.requestedPct } });
    }
    return updated;
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: approve ? "APPROVE" : "REJECT",
      entityType: "DiscountRequest",
      entityId: request.id,
      newValue: request,
    },
  });

  publish({ type: "discount.decided", discountRequestId: request.id, dealId: request.dealId, approved: approve });

  return request;
}
