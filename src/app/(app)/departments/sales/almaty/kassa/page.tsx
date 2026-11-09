import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isLeader, MANAGER_ROLES } from "@/lib/access";
import { loadKassa, loadDebts, STAGE_LABEL } from "@/lib/domain/sales-kassa";
import { SalesTabs } from "../SalesTabs";
import { KassaClient } from "./KassaClient";

const MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const shiftMonth = (m: string, n: number) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 7);
};

export default async function KassaPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 7);
  const leader = isLeader(user);
  const [data, debts, staff] = await Promise.all([
    loadKassa(user, month),
    loadDebts(user),
    leader
      ? prisma.employee.findMany({
          where: { status: "ACTIVE", user: { userRoles: { some: { role: { name: { in: [...MANAGER_ROLES] } } } } } },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-semibold text-text-primary">Продажи · Алматы</h1>
        <SalesTabs on="kassa" />
        <div className="ml-auto flex items-center gap-1.5">
          <Link href={`/departments/sales/almaty/kassa?m=${shiftMonth(month, -1)}`} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-bold">◀</Link>
          <span className="rounded-lg bg-[#0b1a45] px-3.5 py-1 text-sm font-bold text-white">{MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}</span>
          <Link href={`/departments/sales/almaty/kassa?m=${shiftMonth(month, 1)}`} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-bold">▶</Link>
        </div>
      </div>
      <KassaClient data={data} debts={debts} stageLabels={STAGE_LABEL} leader={leader} staff={staff} />
    </div>
  );
}
