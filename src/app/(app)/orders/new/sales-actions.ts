"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createSalesOrder, SalesOrderError, type SalesOrderIn } from "@/lib/domain/orders/sales-order";
import { pushRowToSheet } from "@/lib/domain/sales-ledger/sheet-push";
import { syncWorkshopJobs } from "@/lib/domain/workshop";
import { ForbiddenError } from "@/lib/rbac";

export type SalesOrderResult = { ok: true; orderId: string; orderNumber: string; nos: number[] } | { ok: false; error: string };

export async function createSalesOrderAction(input: SalesOrderIn): Promise<SalesOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
  try {
    const res = await createSalesOrder(user, input);
    // Продажи жолдары → Google кесте (қатар жұмыс кезінде) және «Цех ✓» → Бекзатқа тапсырма
    after(async () => {
      for (const id of res.ledgerIds) await pushRowToSheet(id).catch(() => undefined);
      await syncWorkshopJobs(res.ledgerIds).catch(() => undefined);
    });
    revalidatePath("/orders");
    revalidatePath("/rating");
    revalidatePath("/departments/sales/almaty");
    return { ok: true, orderId: res.orderId, orderNumber: res.orderNumber, nos: res.nos };
  } catch (e) {
    if (e instanceof SalesOrderError) return { ok: false, error: e.message };
    if (e instanceof ForbiddenError) return { ok: false, error: "Заказ ашуға рұқсат жоқ" };
    console.error("[sales-order] create", e instanceof Error ? e.message : e);
    return { ok: false, error: "Заказ сақталмады — қайта байқап көріңіз" };
  }
}
