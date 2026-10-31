import { Users, Star, UserX, Smile } from "lucide-react";
import { Card, StatCard, AccessDenied } from "@/lib/ui";
import { listCustomers } from "@/lib/domain/crm";
import { ForbiddenError } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function CrmDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const tc = t.crm.dashboard;

  try {
    const customers = await listCustomers(user);

    const vipCount = customers.filter((c) => c.isVip).length;
    const inactiveCount = customers.filter((c) => c.isInactive).length;
    const withNps = customers.filter((c) => c.npsScore !== null);
    const avgNps = withNps.length > 0 ? Math.round(withNps.reduce((s, c) => s + (c.npsScore ?? 0), 0) / withNps.length) : null;

    const bySegment = customers.reduce<Record<string, number>>((acc, c) => {
      acc[c.segment] = (acc[c.segment] ?? 0) + 1;
      return acc;
    }, {});

    const newest = [...customers].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={tc.totalCustomers} value={String(customers.length)} icon={Users} />
          <StatCard label={tc.vipCustomers} value={String(vipCount)} icon={Star} />
          <StatCard label={tc.inactiveCustomers} value={String(inactiveCount)} icon={UserX} />
          <StatCard label={tc.avgNps} value={avgNps !== null ? String(avgNps) : "—"} icon={Smile} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={tc.bySegment}>
            <ul className="flex flex-col gap-3">
              {Object.entries(t.crm.segmentLabel).map(([segment, label]) => (
                <li key={segment} className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">{label}</span>
                  <span className="font-semibold tabular-nums text-text-primary">{bySegment[segment] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={tc.newestTitle}>
            {newest.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-secondary">{tc.noCustomers}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {newest.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="text-text-primary">{c.fullName}</span>
                    <span className="text-text-secondary">{c.phone}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
