import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listDeals } from "@/lib/domain/sales";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { formatTenge } from "@/lib/sales-labels";

export default async function SalesAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const ta = t.sales.analytics;

  try {
    const deals = await listDeals(user);

    const won = deals.filter((d) => d.stage === "WON");
    const lost = deals.filter((d) => d.stage === "LOST");
    const closed = won.length + lost.length;
    const conversion = closed > 0 ? Math.round((won.length / closed) * 100) : 0;
    const avgCheck = won.length > 0 ? won.reduce((s, d) => s + Number(d.amount), 0) / won.length : 0;

    const byManager = new Map<string, { name: string; count: number; won: number; amount: number }>();
    for (const d of deals) {
      const key = d.assignedTo.id;
      const entry = byManager.get(key) ?? { name: d.assignedTo.fullName, count: 0, won: 0, amount: 0 };
      entry.count += 1;
      if (d.stage === "WON") {
        entry.won += 1;
        entry.amount += Number(d.amount);
      }
      byManager.set(key, entry);
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{ta.conversion}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-text-primary">{conversion}%</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{ta.avgCheck}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-text-primary">{formatTenge(avgCheck)}</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{ta.lostDeals}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-text-primary">{lost.length}</div>
          </Card>
        </div>

        <Card title={ta.managerKpi}>
          {byManager.size === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{ta.noData}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-text-secondary">
                  <th className="pb-3 font-semibold">{ta.colManager}</th>
                  <th className="pb-3 font-semibold">{ta.colDeals}</th>
                  <th className="pb-3 font-semibold">{ta.colWon}</th>
                  <th className="pb-3 font-semibold">{ta.colAmountWon}</th>
                </tr>
              </thead>
              <tbody>
                {[...byManager.values()].map((m) => (
                  <tr key={m.name} className="border-t border-border">
                    <td className="py-3 text-text-primary">{m.name}</td>
                    <td className="py-3 tabular-nums text-text-primary">{m.count}</td>
                    <td className="py-3 tabular-nums text-text-primary">{m.won}</td>
                    <td className="py-3 font-semibold tabular-nums text-text-primary">{formatTenge(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={ta.aiTitle}>
          <p className="text-sm text-text-secondary">{ta.aiNote}</p>
        </Card>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
