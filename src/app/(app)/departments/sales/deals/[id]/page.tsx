import Link from "next/link";
import { PermissionAction } from "@/lib/db";
import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { can, ForbiddenError } from "@/lib/rbac";
import { getDeal, getDealAuditLog, listSalesEmployees } from "@/lib/domain/sales";
import { listProducts } from "@/lib/domain/orders";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { DEAL_STAGE_TONE, formatTenge } from "@/lib/sales-labels";
import {
  advanceDealAction,
  advanceToOrderAction,
  markPaidAction,
  loseDealAction,
  updateDealAmountAction,
  reassignDealAction,
  requestDiscountAction,
  approveDiscountAction,
  rejectDiscountAction,
} from "../../actions";

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const { id } = await params;
  const { error } = await searchParams;

  try {
    const deal = await getDeal(user, id);
    const canApprove = can(user, "deals", PermissionAction.APPROVE);
    const [auditLog, employees, products] = await Promise.all([
      getDealAuditLog(user, id),
      canApprove ? listSalesEmployees() : Promise.resolve([]),
      deal.stage === "OFFER" ? listProducts() : Promise.resolve([]),
    ]);
    const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { dateStyle: "medium", timeStyle: "short" });
    const isOpen = deal.stage !== "WON" && deal.stage !== "LOST";
    const canEditAmount = ["QUALIFIED", "OFFER"].includes(deal.stage);
    const redirectTo = `/departments/sales/deals/${deal.id}`;

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{deal.customer.fullName}</h1>
            <p className="text-sm text-text-secondary">{dateFmt.format(deal.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={DEAL_STAGE_TONE[deal.stage]}>{dict.sales.dealStageLabel[deal.stage]}</StatusBadge>
            <Link href="/departments/sales/work" className="text-sm font-medium text-accent hover:underline">
              {t("← Тізімге оралу", "← Назад к списку")}
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {isOpen && (
          <Card title={t("Әрекеттер", "Действия")}>
            <div className="flex flex-wrap items-center gap-2">
              {deal.stage === "OFFER" ? (
                <form action={advanceToOrderAction} className="flex flex-wrap items-center gap-1.5">
                  <input type="hidden" name="dealId" value={deal.id} />
                  <select name="productId" required className={selectClass}>
                    <option value="">{t("Тауар таңдау", "Выбрать товар")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatTenge(p.basePrice)}
                      </option>
                    ))}
                  </select>
                  <input type="number" name="qty" defaultValue={1} min={1} aria-label={t("Саны", "Кол-во")} className={`w-16 ${selectClass}`} />
                  <button type="submit" className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                    {t("Тапсырыс жасау", "Создать заказ")}
                  </button>
                </form>
              ) : deal.stage === "ORDER" ? (
                <ActionForm action={markPaidAction} dealId={deal.id} label={t("Төленді деп белгілеу", "Отметить оплаченным")} primary />
              ) : (
                <ActionForm action={advanceDealAction} dealId={deal.id} label={t("Келесі сатыға өту", "Перейти к следующей стадии")} primary />
              )}
              <form action={loseDealAction}>
                <input type="hidden" name="dealId" value={deal.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <button type="submit" className="rounded-pill bg-page-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-border">
                  {t("Жоғалтылды деп белгілеу", "Отметить потерянной")}
                </button>
              </form>
              {deal.discountRequests.every((r) => r.status !== "PENDING") && (
                <form action={requestDiscountAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="dealId" value={deal.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <input type="number" name="requestedPct" placeholder="%" min={1} max={50} className={`w-16 ${selectClass}`} />
                  <button type="submit" className="rounded-pill bg-page-bg px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-border">
                    {t("Жеңілдік сұрау", "Запросить скидку")}
                  </button>
                </form>
              )}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title={t("Мәміле", "Сделка")}>
            <InfoRow label={t("Клиент", "Клиент")} value={deal.customer.fullName} />
            <InfoRow label={t("Телефон", "Телефон")} value={deal.customer.phone} />
            <InfoRow label={t("Көлік", "Автомобиль")} value={deal.car ? `${deal.car.make} ${deal.car.model}` : "—"} />
            {deal.sourceLead && (
              <p className="mt-2 text-xs text-text-secondary">
                {t("Лидтен келді", "Пришло из лида")}:{" "}
                <Link href={`/departments/sales/leads/${deal.sourceLead.id}`} className="text-accent hover:underline">
                  {deal.sourceLead.fullName}
                </Link>
              </p>
            )}
            {deal.order && (
              <p className="mt-2 text-xs text-text-secondary">
                {t("Тапсырыс", "Заказ")}:{" "}
                <Link href={`/orders/${deal.order.id}`} className="text-accent hover:underline">
                  {deal.order.orderNumber}
                </Link>
              </p>
            )}
          </Card>

          <Card title={t("Сома", "Сумма")}>
            {canEditAmount ? (
              <form action={updateDealAmountAction} className="flex items-end gap-2">
                <input type="hidden" name="dealId" value={deal.id} />
                <Field label={t("Сома", "Сумма")}>
                  <input type="number" name="amount" min={0} defaultValue={deal.amount.toString()} className={inputClass} />
                </Field>
                <button type="submit" className="rounded-pill bg-page-bg px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-border">
                  {t("Сақтау", "Сохранить")}
                </button>
              </form>
            ) : (
              <InfoRow label={t("Сома", "Сумма")} value={formatTenge(deal.amount)} bold />
            )}
            <InfoRow label={t("Жеңілдік", "Скидка")} value={Number(deal.discountPct) > 0 ? `${deal.discountPct}%` : "—"} />
          </Card>

          <Card title={t("Тағайындау", "Назначение")}>
            <p className="text-sm text-text-primary">{deal.assignedTo.fullName}</p>
            {canApprove && (
              <form action={reassignDealAction} className="mt-3 flex items-end gap-2 border-t border-border pt-3">
                <input type="hidden" name="dealId" value={deal.id} />
                <Field label={t("Менеджерді ауыстыру", "Сменить менеджера")}>
                  <select name="assignedToId" defaultValue={deal.assignedToId} className={inputClass}>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="submit" className="rounded-pill bg-page-bg px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-border">
                  {t("Ауыстыру", "Сменить")}
                </button>
              </form>
            )}
          </Card>
        </div>

        {deal.discountRequests.length > 0 && (
          <Card title={t("Жеңілдік сұраулары", "Запросы на скидку")}>
            <div className="flex flex-col divide-y divide-border">
              {deal.discountRequests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div className="text-sm text-text-primary">
                    {r.requestedBy.fullName} — {r.requestedPct.toString()}% {t("сұралды", "запрошено")} ·{" "}
                    <span className="text-text-secondary">{r.status}</span>
                    {r.approvedBy && <span className="text-text-secondary"> · {r.approvedBy.fullName}</span>}
                  </div>
                  {r.status === "PENDING" && canApprove && (
                    <div className="flex gap-1.5">
                      <form action={approveDiscountAction}>
                        <input type="hidden" name="discountRequestId" value={r.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <button type="submit" className="rounded-pill bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover">
                          {t("Бекіту", "Одобрить")}
                        </button>
                      </form>
                      <form action={rejectDiscountAction}>
                        <input type="hidden" name="discountRequestId" value={r.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <button type="submit" className="rounded-pill bg-page-bg px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-border">
                          {t("Қабылдамау", "Отклонить")}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title={t("Сатысы тарихы", "История стадий")}>
          <ul className="flex flex-col gap-2 text-sm">
            {deal.stageHistory.map((h) => (
              <li key={h.id} className="flex items-center gap-2">
                <span className="text-text-secondary">{dateFmt.format(h.changedAt)}</span>
                <span className="text-text-primary">
                  {h.changedBy.fullName} — {h.fromStage ? `${dict.sales.dealStageLabel[h.fromStage]} → ` : ""}
                  {dict.sales.dealStageLabel[h.toStage]}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t("Аудит журналы", "Журнал аудита")}>
          {auditLog.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("Жазба жоқ", "Записей нет")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {auditLog.map((a) => (
                <li key={a.id} className="border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">{dateFmt.format(a.createdAt)}</span>
                    <span className="font-medium text-text-primary">
                      {a.actor?.employee?.fullName ?? a.actor?.email ?? t("Жүйе", "Система")} — {a.action}
                    </span>
                  </div>
                  {(a.oldValue || a.newValue) && (
                    <div className="mt-0.5 pl-1 text-xs text-text-secondary">
                      {a.oldValue ? `${JSON.stringify(a.oldValue)} → ` : ""}
                      {a.newValue ? JSON.stringify(a.newValue) : ""}
                    </div>
                  )}
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

const inputClass =
  "rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";
const selectClass = inputClass + " px-2 py-1.5 text-xs";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={bold ? "font-bold text-text-primary" : "text-text-primary"}>{value}</span>
    </div>
  );
}

function ActionForm({
  action,
  dealId,
  label,
  primary,
}: {
  action: (formData: FormData) => void | Promise<void>;
  dealId: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="dealId" value={dealId} />
      <button
        type="submit"
        className={`rounded-pill px-4 py-2 text-sm font-semibold transition-colors ${
          primary ? "bg-accent text-white hover:bg-accent-hover" : "bg-page-bg text-text-primary hover:bg-border"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
