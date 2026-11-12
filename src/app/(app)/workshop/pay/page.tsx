import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canUseWorkshop, isLeader } from "@/lib/access";
import { currentRates, payReport } from "@/lib/domain/workshop";
import { OPERATION_LABEL, OPERATIONS } from "@/lib/domain/workshop/calc";
import { RateEditor } from "./RateEditor";

export const dynamic = "force-dynamic";

const ALMATY = 5 * 3600_000;
const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";

/** Алматы уақытымен күннің басы (UTC Date). */
function almatyDay(d: Date): Date {
  const local = new Date(d.getTime() + ALMATY);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - ALMATY);
}

function periods(now = new Date()) {
  const today = almatyDay(now);
  const dow = (new Date(today.getTime() + ALMATY).getUTCDay() + 6) % 7; // дүйсенбі = 0
  const weekStart = new Date(today.getTime() - dow * 86400_000);
  const local = new Date(today.getTime() + ALMATY);
  const monthStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - ALMATY);
  const prevMonthStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) - ALMATY);
  return {
    week: { label: "Осы апта", from: weekStart, to: new Date(weekStart.getTime() + 7 * 86400_000) },
    lastweek: { label: "Өткен апта", from: new Date(weekStart.getTime() - 7 * 86400_000), to: weekStart },
    month: { label: "Осы ай", from: monthStart, to: new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - ALMATY) },
    lastmonth: { label: "Өткен ай", from: prevMonthStart, to: monthStart },
  };
}

const dayFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Almaty" });

export default async function WorkshopPayPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canUseWorkshop(user)) redirect("/dashboard");

  const sp = await searchParams;
  const all = periods();
  const key = (sp.p && sp.p in all ? sp.p : "week") as keyof typeof all;
  const period = all[key];
  const [report, rates] = await Promise.all([payReport(user, period.from, period.to), currentRates()]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-bold text-text-primary">Айлық есебі</h1>
        <p className="m-0 text-sm text-text-secondary">
          «Дайын» болған тапсырмалар бойынша: әр операция × баға. {dayFmt.format(period.from)} — {dayFmt.format(new Date(period.to.getTime() - 1))}
        </p>
      </div>

      <nav className="flex gap-2 overflow-x-auto" aria-label="Кезең">
        {(Object.keys(all) as Array<keyof typeof all>).map((k) => (
          <Link
            key={k}
            href={`/workshop/pay?p=${k}`}
            className={`whitespace-nowrap rounded-pill px-4 py-2.5 text-sm font-semibold ${
              k === key ? "bg-[#0b1a45] text-white" : "border border-border bg-surface text-text-secondary"
            }`}
          >
            {all[k].label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-card bg-surface p-4 shadow-card">
          <div className="text-sm text-text-secondary">Барлығы төленеді</div>
          <div className="mt-1 text-2xl font-bold">{money(report.total)}</div>
        </div>
        <div className="rounded-card bg-surface p-4 shadow-card">
          <div className="text-sm text-text-secondary">Дайын тапсырма</div>
          <div className="mt-1 text-2xl font-bold">{report.jobs}</div>
        </div>
        <div className="rounded-card bg-surface p-4 shadow-card">
          <div className="text-sm text-text-secondary">Өз кожамыз кетті</div>
          <div className="mt-1 text-2xl font-bold">{String(report.leatherOwnMeters).replace(".", ",")} м</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card bg-surface shadow-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-secondary">
              <th className="border-b border-border px-4 py-3">Қызметкер</th>
              {OPERATIONS.map((op) => (
                <th key={op} className="whitespace-nowrap border-b border-border px-4 py-3 text-right">
                  {OPERATION_LABEL[op]}
                </th>
              ))}
              <th className="border-b border-border px-4 py-3 text-right">Сомасы</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  Бұл кезеңде дайын тапсырма жоқ.
                </td>
              </tr>
            ) : (
              report.lines.map((l) => (
                <tr key={l.worker}>
                  <td className="border-b border-border px-4 py-3 font-semibold">{l.worker}</td>
                  {OPERATIONS.map((op) => (
                    <td key={op} className="border-b border-border px-4 py-3 text-right tabular-nums">
                      {l.counts[op] || "—"}
                    </td>
                  ))}
                  <td className="border-b border-border px-4 py-3 text-right font-bold tabular-nums">{money(l.sum)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
        <h2 className="m-0 text-base font-bold">Операция бағалары</h2>
        <RateEditor rates={rates} labels={OPERATION_LABEL} canEdit={isLeader(user)} />
        <p className="m-0 text-xs text-text-secondary">Баға өзгерсе, жаңасы бүгіннен бастап есептеледі; бұрынғы күндер ескі бағамен қалады.</p>
      </section>
    </div>
  );
}
