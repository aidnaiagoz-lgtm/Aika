import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { listLeads, leadStats, leadsSystemActive, LEAD_ACCOUNTS, LEAD_STATUS_LABEL, accountLabel } from "@/lib/domain/sales-leads";
import { LEAD_REASONS } from "@/lib/domain/sales-ledger/normalize/dictionaries";
import { SalesTabs } from "../SalesTabs";
import { LeadsClient } from "./LeadsClient";

const MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const shiftMonth = (m: string, n: number) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 7);
};

type SP = { m?: string; acc?: string; mgr?: string; reason?: string; today?: string; st?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 7);
  const filters = { month, account: sp.acc || undefined, manager: sp.mgr || undefined, reason: sp.reason || undefined, today: sp.today === "1", status: sp.st || undefined };
  const [leads, stats, todayList, active] = await Promise.all([
    listLeads(user, filters),
    leadStats(month, filters.account),
    listLeads(user, { month, today: true }),
    leadsSystemActive(),
  ]);
  const myToday = todayList.filter((l) => l.editable).length;
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, m: month, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/departments/sales/almaty/leads?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-semibold text-text-primary">Продажи · Алматы</h1>
        <SalesTabs on="leads" />
        <div className="ml-auto flex items-center gap-1.5">
          <Link href={qs({ m: shiftMonth(month, -1) })} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-bold">◀</Link>
          <span className="rounded-lg bg-[#0b1a45] px-3.5 py-1 text-sm font-bold text-white">{MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}</span>
          <Link href={qs({ m: shiftMonth(month, 1) })} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-bold">▶</Link>
        </div>
      </div>

      <LeadsClient
        leads={leads}
        stats={stats}
        filters={{ ...filters, month }}
        myToday={myToday}
        accounts={LEAD_ACCOUNTS.map((a) => ({ code: a.code, label: a.label }))}
        reasons={LEAD_REASONS.map((r) => ({ code: r.code, label: r.label }))}
        statusLabels={LEAD_STATUS_LABEL}
        accountLabels={Object.fromEntries([...LEAD_ACCOUNTS.map((a) => [a.code, a.label]), ["OLX_UNKNOWN", accountLabel("OLX_UNKNOWN")]])}
        leader={isLeader(user)}
        systemActive={active}
        links={{
          clear: qs({ acc: "", mgr: "", reason: "", today: "", st: "" }),
          today: qs({ today: filters.today ? "" : "1" }),
        }}
      />
    </div>
  );
}
