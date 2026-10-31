import Link from "next/link";
import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listPayments, listCashboxes, listCollectingEmployees, getFinanceKpis } from "@/lib/domain/finance";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { formatTenge, paymentMethodLabel } from "@/lib/order-labels";

interface Filters {
  method?: string;
  cashbox?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  error?: string;
}

export default async function FinanceDepartmentPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const methodLabel = paymentMethodLabel(locale);
  const filters = await searchParams;

  try {
    const [payments, cashboxes, employees, kpis] = await Promise.all([
      listPayments(user, filters),
      listCashboxes(),
      listCollectingEmployees(),
      getFinanceKpis(user, filters),
    ]);

    const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { dateStyle: "medium", timeStyle: "short" });
    const noData = t("Дерек жоқ", "Нет данных");

    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold text-text-primary">{t("Қаржы", "Финансы")}</h1>

        {filters.error && (
          <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{filters.error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi label={t("Жиналған сома", "Собранная сумма")} value={formatTenge(kpis.totalCollected)} />
          <Kpi label={t("Төлем саны", "Количество платежей")} value={String(kpis.paymentCount)} />
          <Kpi label={t("Орташа төлем", "Средний платёж")} value={formatTenge(kpis.avgPayment)} />
          <Kpi label={t("Жалпы борыш", "Общий долг")} value={formatTenge(kpis.outstandingDebt)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={t("Әдіс бойынша", "По способу оплаты")}>
            <RankTable rows={kpis.byMethod.map((m) => ({ key: methodLabel[m.method] ?? m.method, value: m.value }))} noData={noData} />
          </Card>
          <Card title={t("Касса бойынша", "По кассе")}>
            <RankTable rows={kpis.byCashbox.map((c) => ({ key: c.cashbox, value: c.value }))} noData={noData} />
          </Card>
        </div>

        <Card>
          <form className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" method="GET">
            <Field label={t("Іздеу", "Поиск")}>
              <input name="search" defaultValue={filters.search} placeholder={t("Заказ № / Клиент", "Заказ № / Клиент")} className={inputClass} />
            </Field>
            <Field label={t("Әдіс", "Способ")}>
              <select name="method" defaultValue={filters.method ?? ""} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {Object.entries(methodLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Касса", "Касса")}>
              <select name="cashbox" defaultValue={filters.cashbox ?? ""} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {cashboxes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Қызметкер", "Сотрудник")}>
              <select name="employeeId" defaultValue={filters.employeeId ?? ""} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Бастап", "С")}>
              <input type="date" name="dateFrom" defaultValue={filters.dateFrom} className={inputClass} />
            </Field>
            <Field label={t("Дейін", "По")}>
              <input type="date" name="dateTo" defaultValue={filters.dateTo} className={inputClass} />
            </Field>
            <button type="submit" className="col-span-2 self-end rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover sm:col-span-1">
              {t("Сүзу", "Фильтр")}
            </button>
          </form>
        </Card>

        <Card title={t("Төлемдер", "Платежи")}>
          {payments.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("Төлем табылмады", "Платежи не найдены")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-2 pr-4 font-semibold">{t("Күні", "Дата")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Заказ", "Заказ")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Клиент", "Клиент")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Сома", "Сумма")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Әдіс", "Способ")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Касса", "Касса")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Қызметкер", "Сотрудник")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Комментарий", "Комментарий")}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-2 pr-4 text-text-secondary">{dateFmt.format(p.paidAt)}</td>
                      <td className="py-2 pr-4">
                        <Link href={`/orders/${p.orderId}`} className="font-medium text-accent hover:underline">
                          {p.order.orderNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">{p.order.customer.fullName}</td>
                      <td className="py-2 pr-4 font-semibold tabular-nums text-text-primary">{formatTenge(p.amount)}</td>
                      <td className="py-2 pr-4 text-text-secondary">{methodLabel[p.method]}</td>
                      <td className="py-2 pr-4 text-text-secondary">{p.cashbox ?? "—"}</td>
                      <td className="py-2 pr-4 text-text-secondary">{p.employee?.fullName ?? "—"}</td>
                      <td className="py-2 pr-4 text-text-secondary">{p.comment ?? "—"}</td>
                    </tr>
                  ))}
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

const inputClass =
  "rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-icon border border-border bg-page-bg p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-bold text-text-primary">{value}</p>
    </div>
  );
}

function RankTable({ rows, noData }: { rows: { key: string; value: number }[]; noData: string }) {
  if (rows.length === 0) return <p className="text-sm text-text-secondary">{noData}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate text-text-secondary">{r.key}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums text-text-primary">{formatTenge(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
