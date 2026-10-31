import { Card, AccessDenied } from "@/lib/ui";
import { listCustomers } from "@/lib/domain/crm";
import { ForbiddenError } from "@/lib/rbac";
import { getDictionary, INTL_LOCALE } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function CrmReportsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const tr = t.crm.reports;

  try {
    const customers = await listCustomers(user);

    return (
      <div className="flex flex-col gap-6">
        <Card title={tr.exportTitle(customers.length)}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-text-secondary">
                  <th className="pb-3 font-semibold">{tr.colName}</th>
                  <th className="pb-3 font-semibold">{tr.colPhone}</th>
                  <th className="pb-3 font-semibold">{tr.colSegment}</th>
                  <th className="pb-3 font-semibold">{tr.colCreated}</th>
                  <th className="pb-3 font-semibold">{tr.colNps}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-3 text-text-primary">{c.fullName}</td>
                    <td className="py-3 text-text-secondary">{c.phone}</td>
                    <td className="py-3 text-text-secondary">{t.crm.segmentLabel[c.segment]}</td>
                    <td className="py-3 text-text-secondary">
                      {new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "2-digit", month: "2-digit", year: "numeric" }).format(
                        c.createdAt
                      )}
                    </td>
                    <td className="py-3 tabular-nums text-text-secondary">{c.npsScore ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-text-secondary">{tr.exportNote}</p>
        </Card>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
