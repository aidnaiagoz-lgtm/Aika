import { Users, Handshake, Wallet, Percent } from "lucide-react";
import { Card, StatCard, AccessDenied } from "@/lib/ui";
import { listLeads, listDeals } from "@/lib/domain/sales";
import { ForbiddenError } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function SalesDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const STAGE_LABEL = t.sales.dealStageLabel;

  try {
    const [leads, deals] = await Promise.all([listLeads(user), listDeals(user)]);

    const activeDeals = deals.filter((d) => d.stage !== "WON" && d.stage !== "LOST");
    const pipelineValue = activeDeals.reduce((sum, d) => sum + Number(d.amount), 0);
    const wonDeals = deals.filter((d) => d.stage === "WON").length;
    const closedDeals = deals.filter((d) => d.stage === "WON" || d.stage === "LOST").length;
    const conversion = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;
    const pendingDiscounts = deals.reduce((sum, d) => sum + d.discountRequests.length, 0);

    const byStage = activeDeals.reduce<Record<string, number>>((acc, d) => {
      acc[d.stage] = (acc[d.stage] ?? 0) + 1;
      return acc;
    }, {});

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t.sales.dashboard.newLeads} value={String(leads.length)} icon={Users} />
          <StatCard label={t.sales.dashboard.openDeals} value={String(activeDeals.length)} icon={Handshake} />
          <StatCard
            label={t.sales.dashboard.pipelineValue}
            value={`${new Intl.NumberFormat("ru-RU").format(pipelineValue)} ₸`}
            icon={Wallet}
          />
          <StatCard label={t.sales.dashboard.conversion} value={`${conversion}%`} icon={Percent} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={t.sales.dashboard.byStage}>
            <ul className="flex flex-col gap-3">
              {Object.entries(STAGE_LABEL)
                .filter(([stage]) => stage !== "WON" && stage !== "LOST")
                .map(([stage, label]) => (
                  <li key={stage} className="flex items-center justify-between text-sm">
                    <span className="text-text-primary">{label}</span>
                    <span className="font-semibold tabular-nums text-text-primary">{byStage[stage] ?? 0}</span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card title={t.sales.dashboard.needsAttention}>
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-text-primary">{t.sales.dashboard.pendingDiscounts}</span>
                <span className="font-semibold tabular-nums text-status-shipping">{pendingDiscounts}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-text-primary">{t.sales.dashboard.uncontactedLeads}</span>
                <span className="font-semibold tabular-nums text-status-new">
                  {leads.filter((l) => l.status === "NEW").length}
                </span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
