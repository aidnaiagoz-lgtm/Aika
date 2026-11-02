import Link from "next/link";
import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listLedgerRows, canEditLedgerRow, canDeleteLedgerRow } from "@/lib/domain/sales-ledger";
import { LEDGER_COLUMNS } from "@/lib/domain/sales-ledger/fields";
import { prisma } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { deleteLedgerRowAction } from "./actions";

function formatCell(type: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) {
    return type === "datetime-local"
      ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(value)
      : new Intl.DateTimeFormat("ru-RU").format(value);
  }
  if (typeof value === "object" && "toString" in value) return String(value);
  return String(value);
}

// Пайдаланушының Google Sheets кестесінің дәл көшірмесі — филиалдың сату журналы.
// Клиенттердің нақты жеке деректері көшірілмеді, тек кесте құрылымы (45 баған).
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
  const t = getDictionary(locale);
  const ta = t.sales.almaty;

  try {
    const branch = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } } });
    if (!branch) {
      return (
        <Card>
          <p className="py-6 text-center text-sm text-text-secondary">{ta.noBranch}</p>
        </Card>
      );
    }

    const rows = await listLedgerRows(user, branch.id, { month, onlyMine });
    const canDelete = canDeleteLedgerRow(user);
    const myEmployeeId = user.employee?.id ?? null;

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{ta.title(branch.name)}</h2>
          <Link
            href="/departments/sales/almaty/new"
            className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            + Жаңа жазба
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={qs(shiftMonth(month, -1), onlyMine)} className="rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-bold">
            ◀
          </Link>
          <span className="rounded-xl bg-[#0b1a45] px-4 py-1.5 text-sm font-bold text-white">
            {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
          </span>
          <Link href={qs(shiftMonth(month, 1), onlyMine)} className="rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-bold">
            ▶
          </Link>
          {myEmployeeId && (
            <Link
              href={qs(month, !onlyMine)}
              className={`ml-2 rounded-xl border px-3 py-1.5 text-sm font-semibold ${onlyMine ? "border-[#1f4fd8] bg-[#e8efff] text-[#1f4fd8]" : "border-border bg-surface text-text-primary"}`}
            >
              {onlyMine ? "✓ Тек менікі" : "Тек менікі"}
            </Link>
          )}
        </div>

        <Card title={`Жазбалар (${rows.length})`}>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{ta.noDeals}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="sticky left-0 z-10 bg-surface pb-3 pr-3 font-semibold">Әрекет</th>
                    {LEDGER_COLUMNS.map((col) => (
                      <th key={col.name} className="whitespace-nowrap pb-3 pr-4 font-semibold">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const editable = canEditLedgerRow(user, row);
                    const mine = myEmployeeId !== null && row.createdById === myEmployeeId;
                    return (
                    <tr key={row.id} className={`border-t border-border ${mine ? "bg-[#f3f6ff]" : ""}`}>
                      <td className={`sticky left-0 z-10 whitespace-nowrap py-2 pr-3 ${mine ? "bg-[#f3f6ff] shadow-[inset_3px_0_0_#1f4fd8]" : "bg-surface"}`}>
                        <div className="flex gap-2">
                          {editable ? (
                            <Link href={`/departments/sales/almaty/${row.id}`} className="text-accent hover:underline">
                              Өзгерту
                            </Link>
                          ) : (
                            <span className="text-text-secondary" title="Тек жазбаны енгізген менеджер өзгерте алады">
                              🔒
                            </span>
                          )}
                          {canDelete && (
                            <form action={deleteLedgerRowAction}>
                              <input type="hidden" name="id" value={row.id} />
                              <button type="submit" className="text-danger hover:underline">
                                Өшіру
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                      {LEDGER_COLUMNS.map((col) => (
                        <td key={col.name} className="whitespace-nowrap py-2 pr-4 text-text-primary">
                          {formatCell(col.type, (row as unknown as Record<string, unknown>)[col.name])}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
