import type { Prisma } from "@/lib/db";
import { scopeWhere } from "@/lib/rbac";
import type { ActingUser } from "./types";

/**
 * Заказдардың рұқсат сүзгісі. Ортақ `scopeWhere` OWN үшін `user.id`-ді қолданады, ал `Order.salesManagerId`
 * — қызметкердің (Employee) id-і. Сондықтан менеджер өз заказын көрмей қалатын (2026-11-10 табылды).
 */
export function orderScopeWhere(user: ActingUser, scope: string): Prisma.OrderWhereInput {
  if (scope === "OWN") return { salesManagerId: user.employee?.id ?? "__no-employee__" };
  return scopeWhere(user, scope as never, { ownerField: "salesManagerId", branchField: "branchId" }) as Prisma.OrderWhereInput;
}

