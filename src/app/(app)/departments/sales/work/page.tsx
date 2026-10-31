import Link from "next/link";
import { PermissionAction } from "@/lib/db";
import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { can, ForbiddenError } from "@/lib/rbac";
import { listLeads, listDeals } from "@/lib/domain/sales";
import { listProducts } from "@/lib/domain/orders";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { DEAL_STAGE_TONE, LEAD_STATUS_TONE, formatTenge } from "@/lib/sales-labels";
import {
  createLeadAction,
  markContactedAction,
  convertLeadAction,
  advanceDealAction,
  advanceToOrderAction,
  markPaidAction,
  loseDealAction,
  requestDiscountAction,
  approveDiscountAction,
  rejectDiscountAction,
} from "../actions";

const LEAD_SOURCES = ["instagram", "tiktok", "olx", "kaspi", "referral", "manual"];

export default async function SalesWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; stage?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const tw = t.sales.work;
  const tt = (kk: string, ru: string) => tr(locale, { kk, ru });
  const filters = await searchParams;

  try {
    const [leads, deals, products] = await Promise.all([
      listLeads(user, { search: filters.search }),
      listDeals(user, { search: filters.search, stage: filters.stage }),
      listProducts(),
    ]);
    const canApproveDiscounts = can(user, "deals", PermissionAction.APPROVE);
    const pendingDiscounts = deals.flatMap((d) =>
      d.discountRequests.map((r) => ({ ...r, dealCustomer: d.customer.fullName, dealAmount: d.amount }))
    );

    return (
      <div className="flex flex-col gap-6">
        {filters.error && (
          <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{filters.error}</div>
        )}

        <Card>
          <form className="flex flex-wrap items-end gap-3" method="GET">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{tt("Іздеу", "Поиск")}</label>
              <input
                name="search"
                defaultValue={filters.search}
                placeholder={tt("Аты / телефон", "Имя / телефон")}
                className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{tt("Мәміле сатысы", "Стадия сделки")}</label>
              <select
                name="stage"
                defaultValue={filters.stage ?? ""}
                className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">{tt("Барлығы", "Все")}</option>
                {Object.entries(t.sales.dealStageLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
              {tt("Сүзу", "Фильтр")}
            </button>
          </form>
        </Card>

        <Card title={tw.addLead}>
          <form action={createLeadAction} className="flex flex-wrap items-end gap-3">
            <Field label={tw.fullName} name="fullName" required />
            <Field label={tw.phone} name="phone" required placeholder={tw.phonePlaceholder} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{tw.source}</label>
              <select
                name="source"
                className="rounded-icon border border-border bg-page-bg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton>{tw.add}</SubmitButton>
          </form>
        </Card>

        <Card title={tw.newLeadsTitle(leads.length)}>
          {leads.length === 0 ? (
            <EmptyState text={tw.noUncontactedLeads} />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {leads.map((lead) => (
                <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/departments/sales/leads/${lead.id}`} className="text-sm font-medium text-accent hover:underline">
                      {lead.fullName}
                    </Link>
                    <div className="text-xs text-text-secondary">
                      {lead.phone} · {lead.source}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={LEAD_STATUS_TONE[lead.status]}>{t.sales.leadStatusLabel[lead.status]}</StatusBadge>
                    {lead.status === "NEW" && (
                      <form action={markContactedAction}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <SmallButton>{tw.contact}</SmallButton>
                      </form>
                    )}
                    <form action={convertLeadAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input
                        type="number"
                        name="amount"
                        placeholder={tw.amountPlaceholder}
                        min={0}
                        required
                        className="w-28 rounded-icon border border-border bg-page-bg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                      <SmallButton primary>{tw.convertToDeal}</SmallButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={tw.allDealsTitle(deals.length)}>
          {deals.length === 0 ? (
            <EmptyState text={tw.noDeals} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-3 font-semibold">{tw.colCustomer}</th>
                    <th className="pb-3 font-semibold">{tw.colAmount}</th>
                    <th className="pb-3 font-semibold">{tw.colDiscount}</th>
                    <th className="pb-3 font-semibold">{tw.colStage}</th>
                    <th className="pb-3 font-semibold">{tw.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id} className="border-t border-border align-top">
                      <td className="py-3">
                        <Link href={`/departments/sales/deals/${deal.id}`} className="font-medium text-accent hover:underline">
                          {deal.customer.fullName}
                        </Link>
                      </td>
                      <td className="py-3 font-semibold tabular-nums text-text-primary">{formatTenge(deal.amount)}</td>
                      <td className="py-3 tabular-nums text-text-secondary">
                        {Number(deal.discountPct) > 0 ? `${deal.discountPct}%` : "—"}
                      </td>
                      <td className="py-3">
                        <StatusBadge tone={DEAL_STAGE_TONE[deal.stage]}>{t.sales.dealStageLabel[deal.stage]}</StatusBadge>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {deal.stage !== "WON" && deal.stage !== "LOST" && (
                            <>
                              {deal.stage === "OFFER" ? (
                                <form action={advanceToOrderAction} className="flex flex-wrap items-center gap-1">
                                  <input type="hidden" name="dealId" value={deal.id} />
                                  <select
                                    name="productId"
                                    required
                                    className="rounded-icon border border-border bg-page-bg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                                  >
                                    <option value="">{tw.selectProduct}</option>
                                    {products.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} — {formatTenge(p.basePrice)}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    name="qty"
                                    defaultValue={1}
                                    min={1}
                                    aria-label={tw.qty}
                                    className="w-14 rounded-icon border border-border bg-page-bg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                                  />
                                  <SmallButton primary>{tw.createOrder}</SmallButton>
                                </form>
                              ) : deal.stage === "ORDER" ? (
                                <form action={markPaidAction}>
                                  <input type="hidden" name="dealId" value={deal.id} />
                                  <SmallButton primary>{tw.markPaid}</SmallButton>
                                </form>
                              ) : (
                                <form action={advanceDealAction}>
                                  <input type="hidden" name="dealId" value={deal.id} />
                                  <SmallButton primary>{tw.nextStage}</SmallButton>
                                </form>
                              )}
                              <form action={loseDealAction}>
                                <input type="hidden" name="dealId" value={deal.id} />
                                <SmallButton>{tw.markLost}</SmallButton>
                              </form>
                              {deal.discountRequests.length === 0 && (
                                <form action={requestDiscountAction} className="flex items-center gap-1">
                                  <input type="hidden" name="dealId" value={deal.id} />
                                  <input
                                    type="number"
                                    name="requestedPct"
                                    placeholder="%"
                                    min={1}
                                    max={50}
                                    className="w-14 rounded-icon border border-border bg-page-bg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                                  />
                                  <SmallButton>{tw.requestDiscount}</SmallButton>
                                </form>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {canApproveDiscounts && (
          <Card title={tw.discountRequestsTitle(pendingDiscounts.length)}>
            {pendingDiscounts.length === 0 ? (
              <EmptyState text={tw.noPendingDiscounts} />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {pendingDiscounts.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="text-sm text-text-primary">
                      {tw.discountRequestLine(r.dealCustomer, formatTenge(r.dealAmount), r.requestedPct.toString())}
                    </div>
                    <div className="flex gap-1.5">
                      <form action={approveDiscountAction}>
                        <input type="hidden" name="discountRequestId" value={r.id} />
                        <SmallButton primary>{tw.approve}</SmallButton>
                      </form>
                      <form action={rejectDiscountAction}>
                        <input type="hidden" name="discountRequestId" value={r.id} />
                        <SmallButton>{tw.reject}</SmallButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="rounded-icon border border-border bg-page-bg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
    >
      {children}
    </button>
  );
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

function EmptyState({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-text-secondary">{text}</p>;
}
