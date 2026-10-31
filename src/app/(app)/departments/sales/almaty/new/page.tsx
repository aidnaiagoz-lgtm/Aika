import Link from "next/link";
import { previewNextNo } from "@/lib/domain/sales-ledger";
import { prisma } from "@/lib/db";
import { LedgerForm } from "../LedgerForm";
import { createLedgerRowAction } from "../actions";

export default async function NewLedgerRowPage() {
  const branch = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } } });
  const nextNo = branch ? await previewNextNo(branch.id) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Жаңа жазба — Сату Алматы</h2>
        <Link href="/departments/sales/almaty" className="text-sm font-medium text-accent hover:underline">
          ← Кестеге оралу
        </Link>
      </div>
      <LedgerForm action={createLedgerRowAction} defaultValues={{ no: nextNo }} submitLabel="Сақтау" />
    </div>
  );
}
