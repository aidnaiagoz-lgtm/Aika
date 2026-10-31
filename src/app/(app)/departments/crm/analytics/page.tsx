import { Card, AccessDenied } from "@/lib/ui";
import { listCustomers } from "@/lib/domain/crm";
import { ForbiddenError } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { formatTenge } from "@/lib/sales-labels";

export default async function CrmAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const ta = t.crm.analytics;

  try {
    const customers = await listCustomers(user);

    const bySegment = customers.reduce<Record<string, number>>((acc, c) => {
      acc[c.segment] = (acc[c.segment] ?? 0) + 1;
      return acc;
    }, {});
    const vipShare = customers.length > 0 ? Math.round((customers.filter((c) => c.isVip).length / customers.length) * 100) : 0;
    const inactiveShare =
      customers.length > 0 ? Math.round((customers.filter((c) => c.isInactive).length / customers.length) * 100) : 0;
    const withNps = customers.filter((c) => c.npsScore !== null);
    const avgNps = withNps.length > 0 ? Math.round(withNps.reduce((s, c) => s + (c.npsScore ?? 0), 0) / withNps.length) : null;

    const top = [...customers]
      .map((c) => ({ id: c.id, name: c.fullName, spent: c.deals.reduce((s, d) => s + Number(d.amount), 0) }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 8);

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{ta.vipShare}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-text-primary">{vipShare}%</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{ta.inactiveShare}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-text-primary">{inactiveShare}%</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{ta.avgNps}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-text-primary">{avgNps ?? "—"}</div>
          </Card>
        </div>

        <Card title={ta.bySegment}>
          <ul className="flex flex-col gap-3">
            {Object.entries(t.crm.segmentLabel).map(([segment, label]) => (
              <li key={segment} className="flex items-center justify-between text-sm">
                <span className="text-text-primary">{label}</span>
                <span className="font-semibold tabular-nums text-text-primary">{bySegment[segment] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={ta.topCustomers}>
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{ta.noData}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-text-secondary">
                  <th className="pb-3 font-semibold">{ta.colName}</th>
                  <th className="pb-3 font-semibold">{ta.colSpent}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-3 text-text-primary">{c.name}</td>
                    <td className="py-3 font-semibold tabular-nums text-text-primary">{formatTenge(c.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
