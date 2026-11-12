"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { pushRowToSheet } from "@/lib/domain/sales-ledger/sheet-push";
import { syncWorkshopJobs } from "@/lib/domain/workshop";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createLedgerRow, updateLedgerRow, recomputeLedgerRow, canEditLedgerRow } from "@/lib/domain/sales-ledger";
import { LEDGER_COLUMNS } from "@/lib/domain/sales-ledger/fields";
import { COMPUTED_FIELDS } from "@/lib/domain/sales-ledger/sheet-layout";
import { getSalesSource } from "@/lib/domain/settings";
import { toClientRow, type ClientRow } from "./client-row";

const SYNCED_MSG = "Бұл жол Google таблицадан келген — оны таблицада өзгертіңіз (мұнда өзі жаңарады)";

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
    const col = LEDGER_COLUMNS.find((c) => c.name === field);
    if (!col || col.readOnly || COMPUTED_FIELDS.has(field)) return { ok: false, error: "Бұл баған өздігінен толады" };
    const existing = await prisma.salesLedgerRow.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Жол жаңарды — бетті қайта ашыңыз" };
    if (existing.importKey?.startsWith("excel:") && (await getSalesSource()) === "sheet")
      return { ok: false, error: SYNCED_MSG };
    if (!canEditLedgerRow(user, existing)) return { ok: false, error: "Бұл жолды тек оны енгізген менеджер өзгерте алады" };
    await updateLedgerRow(user, id, { [field]: parseValue(col.type, raw) } as never);
    const row = await recomputeLedgerRow(id);
    after(() => pushRowToSheet(id)); // сайтта жазылған жол → Google кесте
    after(() => syncWorkshopJobs([id]).then(() => undefined)); // «Цех ✓» → цех тапсырмасы
    revalidatePath("/rating");
    return { ok: true, row: toClientRow(row, true) };
  } catch (e) {
    console.error("[sheet-action] updateCell", field, e);
    return { ok: false, error: e instanceof Error ? e.message : "Сақталмады" };
  }
}

/** Бос жолға жазылған бірінші мән: жаңа сатылым ашады (Дата — бүгін, Менеджер — өзі) және сол ұяшықты сақтайды. */
export async function createRowAction(field: string, raw: string): Promise<Result> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Сессия аяқталған — қайта кіріңіз" };
    const col = LEDGER_COLUMNS.find((c) => c.name === field);
    if (!col || col.readOnly || COMPUTED_FIELDS.has(field)) return { ok: false, error: "Бұл баған өздігінен толады" };
    const value = parseValue(col.type, raw);
    const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
    const created = await createLedgerRow(user, await almatyBranchId(), {
      date: `${today}T00:00:00Z`,
      manager: user.employee?.fullName ?? null,
      [field]: value,
    } as never);
    const row = await recomputeLedgerRow(created.id);
    after(() => pushRowToSheet(created.id));
    after(() => syncWorkshopJobs([created.id]).then(() => undefined));
    revalidatePath("/rating");
    return { ok: true, row: toClientRow(row, true) };
  } catch (e) {
    console.error("[sheet-action] createRow", field, e);
    return { ok: false, error: e instanceof Error ? e.message : "Сатылым ашылмады" };
  }
}
