import { Card, AccessDenied } from "@/lib/ui";
import { listCustomers } from "@/lib/domain/crm";
import { ForbiddenError } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { toggleInactiveAction, setNpsAction } from "../actions";

export default async function CrmWorkPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const tw = t.crm.work;

  try {
    const [inactive, missingNps] = await Promise.all([
      listCustomers(user, { inactiveOnly: true }),
      listCustomers(user, { missingNpsOnly: true }),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <Card title={tw.inactiveTitle(inactive.length)}>
          {inactive.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{tw.noInactive}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {inactive.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">{c.fullName}</div>
                    <div className="text-xs text-text-secondary">{c.phone}</div>
                  </div>
                  <form action={toggleInactiveAction}>
                    <input type="hidden" name="customerId" value={c.id} />
                    <input type="hidden" name="nextInactive" value="false" />
                    <SmallButton primary>{tw.reactivate}</SmallButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={tw.npsTitle(missingNps.length)}>
          {missingNps.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{tw.noMissingNps}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {missingNps.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">{c.fullName}</div>
                    <div className="text-xs text-text-secondary">{c.phone}</div>
                  </div>
                  <form action={setNpsAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="customerId" value={c.id} />
                    <input
                      type="number"
                      name="npsScore"
                      min={0}
                      max={10}
                      placeholder={tw.npsPlaceholder}
                      required
                      className="w-16 rounded-icon border border-border bg-page-bg px-2 py-1.5 text-xs text-text-primary"
                    />
                    <SmallButton primary>{tw.setNps}</SmallButton>
                  </form>
                </div>
              ))}
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

function SmallButton({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="submit"
      className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
        primary ? "bg-accent text-white hover:bg-accent-hover" : "bg-page-bg text-text-primary hover:bg-border"
      }`}
    >
      {children}
    </button>
  );
}
