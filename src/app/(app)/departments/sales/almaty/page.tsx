import Link from "next/link";
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
    const clientRows = sorted.map((r) => toClientRow(r as never, canEditLedgerRow(user, r)));
    const readOnlyReason =
      source === "sheet"
        ? "Әзірге сатылымдар Google таблицаға жазылады — бұл кесте одан 10 минут сайын өздігінен жаңарады (тек оқу). Жаңа сатылым қосу үшін «Жаңа сатылым» батырмасын басыңыз."
        : null;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-3 text-lg font-semibold text-text-primary">Продажи · Алматы</h1>
          <Link href={qs(shiftMonth(month, -1), onlyMine)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-bold">
            ◀
          </Link>
          <span className="rounded-lg bg-[#0b1a45] px-3.5 py-1 text-sm font-bold text-white">
            {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
          </span>
          <Link href={qs(shiftMonth(month, 1), onlyMine)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-bold">
            ▶
          </Link>
          {user.employee && (
            <Link
              href={qs(month, !onlyMine)}
              className={`ml-1 rounded-lg border px-3 py-1 text-sm font-semibold ${onlyMine ? "border-[#1f4fd8] bg-[#e8efff] text-[#1f4fd8]" : "border-border bg-surface text-text-primary"}`}
            >
              {onlyMine ? "✓ Тек менікі" : "Тек менікі"}
            </Link>
          )}
        </div>

        <SheetGrid
          key={`${month}-${onlyMine}`}
          columns={LEDGER_COLUMNS.map((c) => ({ name: c.name, type: c.type }))}
          initialRows={clientRows}
          options={options}
          priceByProduct={priceByProduct}
          canAdd={source === "site" && !!user.employee}
          readOnlyReason={readOnlyReason}
          sheetUrl={process.env.SALES_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.SALES_SHEET_ID}/edit` : null}
          canSwitchSource={isLeader(user)}
        />
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
