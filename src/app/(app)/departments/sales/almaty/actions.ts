"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createLedgerRow, updateLedgerRow, deleteLedgerRow, type LedgerRowInput } from "@/lib/domain/sales-ledger";
import { LEDGER_COLUMNS } from "@/lib/domain/sales-ledger/fields";
import { getCurrentUser } from "@/lib/auth";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Сессия аяқталған");
  return user;
}

function formDataToInput(formData: FormData): LedgerRowInput {
  const input: Record<string, unknown> = {};
  for (const col of LEDGER_COLUMNS) {
    if (col.readOnly) continue; // мыс. "№" — сервер автоматты түрде тағайындайды
    const raw = formData.get(col.name);
    const value = typeof raw === "string" && raw.trim() !== "" ? raw : null;
    input[col.name] = col.type === "number" && value !== null ? Number(value) : value;
  }
  return input as LedgerRowInput;
}

async function almatyBranchId() {
  const branch = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } } });
  if (!branch) throw new Error("Алматы филиалы табылмады");
  return branch.id;
}

export async function createLedgerRowAction(formData: FormData) {
  const user = await requireUser();
  const branchId = await almatyBranchId();
  await createLedgerRow(user, branchId, formDataToInput(formData));
  revalidatePath("/departments/sales/almaty");
  redirect("/departments/sales/almaty");
}

export async function updateLedgerRowAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await updateLedgerRow(user, id, formDataToInput(formData));
  revalidatePath("/departments/sales/almaty");
  redirect("/departments/sales/almaty");
}

export async function deleteLedgerRowAction(formData: FormData) {
  const user = await requireUser();
  await deleteLedgerRow(user, String(formData.get("id")));
  revalidatePath("/departments/sales/almaty");
}
