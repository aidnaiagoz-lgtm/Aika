import Link from "next/link";
import { after } from "next/server";
import { maybeSyncFromGoogleSheet } from "@/lib/domain/sales-ledger/sheet-sync";
import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listLedgerRows, canEditLedgerRow, getLedgerOptions } from "@/lib/domain/sales-ledger";
import { LEDGER_COLUMNS } from "@/lib/domain/sales-ledger/fields";
import { getSalesSource } from "@/lib/domain/settings";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { isLeader } from "@/lib/access";
import { SheetGrid } from "./SheetGrid";
import { workshopStatusByLedger } from "@/lib/domain/workshop";
import { isChecked } from "@/lib/domain/sales-ledger/sheet-layout";
import { SalesTabs } from "./SalesTabs";
import { toClientRow } from "./client-row";

// «Продажи» — Google таблицадағы «продажи» парағының сайттағы нұсқасы (45 баған, сол түстер мен ені).
const MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
function shiftMonth(m: string, n: number) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 7);
}

export default async function SalesAlmatyPage({ searchParams }: { searchParams: Promise<{ m?: string; mine?: string }> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);
  const onlyMine = sp.mine === "1";
  const qs = (m: string, mine: boolean) => `/departments/sales/almaty?m=${m}${mine ? "&mine=1" : ""}`;
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();

  try {
    const branch = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } } });
    if (!branch) return <p className="py-6 text-center text-sm text-text-secondary">Алматы филиалы табылмады</p>;

    const [rows, { options, priceByProduct }, source] = await Promise.all([
      listLedgerRows(user, branch.id, { month, onlyMine }),
      getLedgerOptions(branch.id),
      getSalesSource(),
    ]);
    // Таблицадағыдай — № бойынша өсу ретімен (жаңалары төменде)
    const sorted = [...rows].sort((a, b) => a.no - b.no);
    // «Менеджер» тізімі: CEO/РОП — барлық менеджерлер, менеджер — тек өз аты
    if (!isLeader(user)) options.manager = user.employee ? [user.employee.fullName] : [];
    // Екі жақта да толтыруға болады: Google таблицадағы жолдар сайтқа өзі түседі (оларды таблицада өзгертеді),
    // сайтта жазылған жолдарды сайтта өзгертеді.
    const lockSynced = source === "sheet";
    const clientRows = sorted.map((r) =>
      toClientRow(r as never, canEditLedgerRow(user, r) && !(lockSynced && r.importKey?.startsWith("excel:")))
    );
    const wsMap = await workshopStatusByLedger(sorted.filter((r) => isChecked(r.workshop)).map((r) => r.id));
    const workshopStatus = Object.fromEntries(wsMap);
    // Таблицадан жаңа жолдарды тартып алу (2 минутта бір реттен жиі емес)
    if (source === "sheet") after(maybeSyncFromGoogleSheet);

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-lg font-semibold text-text-primary">Продажи · Алматы</h1>
          <SalesTabs on="sales" />
          <Link href={qs(shiftMonth(month, -1), onlyMine)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-bold">
            ◀
          </Link>
          <span className="rounded-lg bg-[#0b1a45] px-3.5 py-1 text-sm font-bold text-white">
            {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
          </span>
          <Link href={qs(shiftMonth(month, 1), onlyMine)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-bold">
            ▶
          </Link>
        </div>

        <SheetGrid
          key={`${month}-${onlyMine}`}
          columns={LEDGER_COLUMNS.map((c) => ({ name: c.name, type: c.type }))}
          initialRows={clientRows}
          options={options}
          priceByProduct={priceByProduct}
          canAdd={!!user.employee}
          readOnlyReason={null}
          workshopStatus={workshopStatus}
        />
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
