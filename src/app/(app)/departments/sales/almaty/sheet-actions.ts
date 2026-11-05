"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createLedgerRow, updateLedgerRow, recomputeLedgerRow, canEditLedgerRow } from "@/lib/domain/sales-ledger";
import { LEDGER_COLUMNS } from "@/lib/domain/sales-ledger/fields";
import { COMPUTED_FIELDS } from "@/lib/domain/sales-ledger/sheet-layout";
import { getSalesSource } from "@/lib/domain/settings";
import { toClientRow, type ClientRow } from "./client-row";

type Result = { ok: true; row: ClientRow } | { ok: false; error: string };

async function almatyBranchId() {
  const branch = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } } });
  if (!branch) throw new Error("Алматы филиалы табылмады");
  return branch.id;
}

function parseValue(type: string, raw: string | null): unknown {
  const v = raw === null ? "" : raw.trim();
  if (v === "") return null;
  if (type === "number") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n)) throw new Error("Сан енгізіңіз");
    return n;
  }
  if (type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Күн форматы қате");
    return `${v}T00:00:00Z`;
  }
  if (type === "datetime-local") {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) throw new Error("Күн/уақыт форматы қате");
    return `${v}:00+05:00`; // Алматы уақыты
  }
  return v;
}

/** Бір ұяшықты сақтау (Google таблицадағыдай). */
export async function updateCellAction(id: string, field: string, raw: string | null): Promise<Result> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Сессия аяқталған" };
    if ((await getSalesSource()) === "sheet") return { ok: false, error: "Әзірге деректер Google таблицада толтырылады" };
    const col = LEDGER_COLUMNS.find((c) => c.name === field);
    if (!col || col.readOnly || COMPUTED_FIELDS.has(field)) return { ok: false, error: "Бұл баған өздігінен толады" };
    const existing = await prisma.salesLedgerRow.findUniqueOrThrow({ where: { id } });
    if (!canEditLedgerRow(user, existing)) return { ok: false, error: "Бұл жолды тек оны енгізген менеджер өзгерте алады" };
    await updateLedgerRow(user, id, { [field]: parseValue(col.type, raw) } as never);
    const row = await recomputeLedgerRow(id);
    return { ok: true, row: toClientRow(row, true) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Сақталмады" };
  }
}

/** Жаңа жол: Дата — бүгін, Менеджер — өзі. */
export async function addRowAction(): Promise<Result> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Сессия аяқталған" };
    if ((await getSalesSource()) === "sheet") return { ok: false, error: "Әзірге деректер Google таблицада толтырылады" };
    const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
    const created = await createLedgerRow(user, await almatyBranchId(), {
      date: `${today}T00:00:00Z`,
      manager: user.employee?.fullName ?? null,
    } as never);
    const row = await recomputeLedgerRow(created.id);
    revalidatePath("/rating");
    return { ok: true, row: toClientRow(row, true) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Жол қосылмады" };
  }
}
