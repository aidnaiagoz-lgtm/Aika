import Link from "next/link";
import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { getCustomerDetail } from "@/lib/domain/crm";
import { ForbiddenError } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { formatTenge, DEAL_STAGE_TONE, LEAD_STATUS_TONE } from "@/lib/sales-labels";
import {
  setSegmentAction,
  toggleVipAction,
  toggleInactiveAction,
  setNpsAction,
  addContactAction,
  addCarAction,
} from "../../actions";

export default async function CrmCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const td = t.crm.detail;

  try {
    const customer = await getCustomerDetail(user, id);
    const totalSpent = customer.deals.filter((d) => d.stage === "WON").reduce((s, d) => s + Number(d.amount), 0);

    return (
      <div className="flex flex-col gap-6">
        <Link href="/departments/crm/customers" className="text-sm font-semibold text-accent hover:underline">
          {td.back}
        </Link>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-primary">{customer.fullName}</h2>
                {customer.isVip && <StatusBadge tone="shipping">{td.vip}</StatusBadge>}
                {customer.isInactive && <StatusBadge tone="neutral">{td.inactive}</StatusBadge>}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {customer.phone} · {t.crm.segmentLabel[customer.segment]} · {formatTenge(totalSpent)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form action={setSegmentAction} className="flex items-center gap-1.5">
                <input type="hidden" name="customerId" value={customer.id} />
                <select
                  name="segment"
                  defaultValue={customer.segment}
                  className="rounded-icon border border-border bg-page-bg px-2.5 py-1.5 text-xs text-text-primary"
                >
                  {Object.entries(t.crm.segmentLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <SmallButton>{td.save}</SmallButton>
              </form>

              <form action={toggleVipAction}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="nextVip" value={(!customer.isVip).toString()} />
                <SmallButton>{customer.isVip ? td.unmakeVip : td.makeVip}</SmallButton>
              </form>

              <form action={toggleInactiveAction}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="nextInactive" value={(!customer.isInactive).toString()} />
                <SmallButton>{customer.isInactive ? td.makeActive : td.makeInactive}</SmallButton>
              </form>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm">
            <span className="font-semibold text-text-primary">{td.nps}:</span>
            <span className="text-text-secondary">{customer.npsScore ?? td.npsNotSet}</span>
            <form action={setNpsAction} className="flex items-center gap-1.5">
              <input type="hidden" name="customerId" value={customer.id} />
              <input
                type="number"
                name="npsScore"
                min={0}
                max={10}
                defaultValue={customer.npsScore ?? undefined}
                className="w-16 rounded-icon border border-border bg-page-bg px-2 py-1 text-xs text-text-primary"
              />
              <SmallButton>{td.save}</SmallButton>
            </form>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={td.contactsTitle}>
            {customer.contacts.length === 0 ? (
              <p className="pb-3 text-sm text-text-secondary">{td.noContacts}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {customer.contacts.map((ct) => (
                  <li key={ct.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-text-secondary">{ct.channel}</span>
                    <span className="text-text-primary">{ct.value}</span>
                  </li>
                ))}
              </ul>
            )}
            <form action={addContactAction} className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <input type="hidden" name="customerId" value={customer.id} />
              <input
                name="channel"
                required
                placeholder={td.channelPlaceholder}
                className="flex-1 min-w-[120px] rounded-icon border border-border bg-page-bg px-2.5 py-1.5 text-xs text-text-primary"
              />
              <input
                name="value"
                required
                placeholder={td.valuePlaceholder}
                className="flex-1 min-w-[120px] rounded-icon border border-border bg-page-bg px-2.5 py-1.5 text-xs text-text-primary"
              />
              <SmallButton primary>{td.addContact}</SmallButton>
            </form>
          </Card>

          <Card title={td.carsTitle}>
            {customer.cars.length === 0 ? (
              <p className="pb-3 text-sm text-text-secondary">{td.noCars}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {customer.cars.map((car) => (
                  <li key={car.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-text-primary">
                      {car.make} {car.model}
                    </span>
                    <span className="text-text-secondary">{car.year ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
            <form action={addCarAction} className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <input type="hidden" name="customerId" value={customer.id} />
              <input
                name="make"
                required
                placeholder={td.makePlaceholder}
                className="flex-1 min-w-[100px] rounded-icon border border-border bg-page-bg px-2.5 py-1.5 text-xs text-text-primary"
              />
              <input
                name="model"
                required
                placeholder={td.modelPlaceholder}
                className="flex-1 min-w-[100px] rounded-icon border border-border bg-page-bg px-2.5 py-1.5 text-xs text-text-primary"
              />
              <input
                name="year"
                type="number"
                placeholder={td.yearPlaceholder}
                className="w-20 rounded-icon border border-border bg-page-bg px-2.5 py-1.5 text-xs text-text-primary"
              />
              <SmallButton primary>{td.addCar}</SmallButton>
            </form>
          </Card>
        </div>

        <Card title={td.dealsTitle}>
          {customer.deals.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{td.noDeals}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-3 font-semibold">Сома</th>
                    <th className="pb-3 font-semibold">Менеджер</th>
                    <th className="pb-3 font-semibold">Саты</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.deals.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="py-3 font-semibold tabular-nums text-text-primary">{formatTenge(d.amount)}</td>
                      <td className="py-3 text-text-secondary">{d.assignedTo.fullName}</td>
                      <td className="py-3">
                        <StatusBadge tone={DEAL_STAGE_TONE[d.stage]}>{t.sales.dealStageLabel[d.stage]}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={td.leadsTitle}>
          {customer.leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{td.noLeads}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {customer.leads.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-text-primary">{lead.source}</span>
                  <StatusBadge tone={LEAD_STATUS_TONE[lead.status]}>{t.sales.leadStatusLabel[lead.status]}</StatusBadge>
                </li>
              ))}
            </ul>
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
