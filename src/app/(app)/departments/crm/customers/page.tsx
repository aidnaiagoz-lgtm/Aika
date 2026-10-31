import Link from "next/link";
import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { listCustomers } from "@/lib/domain/crm";
import { ForbiddenError } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { formatTenge } from "@/lib/sales-labels";

export default async function CrmCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { q, filter } = await searchParams;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const tc = t.crm.customers;

  try {
    const customers = await listCustomers(user, {
      search: q,
      vipOnly: filter === "vip",
      inactiveOnly: filter === "inactive",
    });

    return (
      <div className="flex flex-col gap-6">
        <Card>
          <form className="flex flex-wrap items-end gap-3" method="GET">
            <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{tc.searchPlaceholder}</label>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder={tc.searchPlaceholder}
                className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Filter</label>
              <select
                name="filter"
                defaultValue={filter ?? ""}
                className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">{tc.filterAll}</option>
                <option value="vip">{tc.filterVip}</option>
                <option value="inactive">{tc.filterInactive}</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {tc.searchPlaceholder}
            </button>
          </form>
        </Card>

        <Card>
          {customers.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{tc.noCustomers}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-3 font-semibold">{tc.colName}</th>
                    <th className="pb-3 font-semibold">{tc.colPhone}</th>
                    <th className="pb-3 font-semibold">{tc.colSegment}</th>
                    <th className="pb-3 font-semibold">{tc.colCars}</th>
                    <th className="pb-3 font-semibold">{tc.colDeals}</th>
                    <th className="pb-3 font-semibold">{tc.colSpent}</th>
                    <th className="pb-3 font-semibold">{tc.colNps}</th>
                    <th className="pb-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const spent = c.deals.reduce((s, d) => s + Number(d.amount), 0);
                    return (
                      <tr key={c.id} className="border-t border-border">
                        <td className="py-3 text-text-primary">
                          <span className="flex items-center gap-2">
                            {c.fullName}
                            {c.isVip && <StatusBadge tone="shipping">VIP</StatusBadge>}
                            {c.isInactive && <StatusBadge tone="neutral">—</StatusBadge>}
                          </span>
                        </td>
                        <td className="py-3 text-text-secondary">{c.phone}</td>
                        <td className="py-3 text-text-secondary">{t.crm.segmentLabel[c.segment]}</td>
                        <td className="py-3 tabular-nums text-text-secondary">{c.cars.length}</td>
                        <td className="py-3 tabular-nums text-text-secondary">{c._count.deals}</td>
                        <td className="py-3 font-semibold tabular-nums text-text-primary">{formatTenge(spent)}</td>
                        <td className="py-3 tabular-nums text-text-secondary">{c.npsScore ?? "—"}</td>
                        <td className="py-3">
                          <Link href={`/departments/crm/customers/${c.id}`} className="text-sm font-semibold text-accent hover:underline">
                            {tc.view}
                          </Link>
                        </td>
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
