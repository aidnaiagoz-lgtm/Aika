import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listDeals } from "@/lib/domain/sales";
import { getDictionary, INTL_LOCALE } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { DEAL_STAGE_TONE, formatTenge } from "@/lib/sales-labels";

export default async function SalesReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { from, to } = await searchParams;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const tr = t.sales.reports;

  try {
    const deals = await listDeals(user);
    const filtered = deals.filter((d) => {
      if (from && d.createdAt < new Date(from)) return false;
      if (to && d.createdAt > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
    const total = filtered.reduce((s, d) => s + Number(d.amount), 0);

    return (
      <div className="flex flex-col gap-6">
        <Card>
          <form className="flex flex-wrap items-end gap-3" method="GET">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{tr.from}</label>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{tr.to}</label>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <button
              type="submit"
              className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {tr.filter}
            </button>
          </form>
        </Card>

        <Card title={tr.dealsReportTitle(filtered.length, formatTenge(total))}>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{tr.noDealsInRange}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-3 font-semibold">{tr.colDate}</th>
                    <th className="pb-3 font-semibold">{tr.colCustomer}</th>
                    <th className="pb-3 font-semibold">{tr.colManager}</th>
                    <th className="pb-3 font-semibold">{tr.colAmount}</th>
                    <th className="pb-3 font-semibold">{tr.colStage}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="py-3 text-text-secondary">
                        {new Intl.DateTimeFormat(INTL_LOCALE[locale], {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        }).format(d.createdAt)}
                      </td>
                      <td className="py-3 text-text-primary">{d.customer.fullName}</td>
                      <td className="py-3 text-text-secondary">{d.assignedTo.fullName}</td>
                      <td className="py-3 font-semibold tabular-nums text-text-primary">{formatTenge(d.amount)}</td>
                      <td className="py-3">
                        <StatusBadge tone={DEAL_STAGE_TONE[d.stage]}>{t.sales.dealStageLabel[d.stage]}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-text-secondary">{tr.exportNote}</p>
        </Card>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
