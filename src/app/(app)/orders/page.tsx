import Link from "next/link";
import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listOrders, paymentStatus, orderProductionStatus, listSalesManagers, listProducts, runScheduledOrderChecks } from "@/lib/domain/orders";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import {
  orderStatusLabel,
  ORDER_STATUS_TONE,
  paymentStatusLabel,
  PAYMENT_STATUS_TONE,
  fulfillmentLabel,
  formatTenge,
} from "@/lib/order-labels";

interface OrderFilters {
  search?: string;
  status?: string;
  managerId?: string;
  branchId?: string;
  source?: string;
  vehicleBrand?: string;
  productId?: string;
  city?: string;
  fulfillmentType?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<OrderFilters> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const filters = await searchParams;

  // §39 — cron жоқ, сондықтан тізім бетінің әр жүктелуінде idempotent тексеріс жүреді
  // (бүгін бір заказға бір рет қана notification жазылады, page load-ты бөгемеу үшін
  // нәтижесін күтпейміз).
  runScheduledOrderChecks().catch((e) => console.error("runScheduledOrderChecks:", e));

  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const statusLabel = orderStatusLabel(locale);
  const payStatusLabel = paymentStatusLabel(locale);
  const fulfillLabel = fulfillmentLabel(locale);

  try {
    const [orders, managers, products, branches] = await Promise.all([
      listOrders(user, filters),
      listSalesManagers(),
      listProducts(),
      prisma.branch.findMany({ orderBy: { name: "asc" } }),
    ]);

    const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { day: "2-digit", month: "2-digit", year: "numeric" });

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">{t("Заказдар", "Заказы")}</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/orders/analytics"
              className="rounded-pill bg-page-bg px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-border"
            >
              {t("Аналитика / KPI", "Аналитика / KPI")}
            </Link>
            <Link
              href="/orders/new"
              className="rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {t("+ Жаңа заказ", "+ Новый заказ")}
            </Link>
          </div>
        </div>

        <Card>
          <form className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" method="GET">
            <Field label={t("Іздеу", "Поиск")}>
              <input
                type="search"
                name="search"
                defaultValue={filters.search}
                placeholder={t("№, телефон, клиент, көлік...", "№, телефон, клиент, авто...")}
                className={inputClass}
              />
            </Field>
            <Field label={t("Статус", "Статус")}>
              <select name="status" defaultValue={filters.status} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {Object.entries(statusLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Менеджер", "Менеджер")}>
              <select name="managerId" defaultValue={filters.managerId} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Филиал", "Филиал")}>
              <select name="branchId" defaultValue={filters.branchId} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Тауар", "Товар")}>
              <select name="productId" defaultValue={filters.productId} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Жеткізу түрі", "Тип доставки")}>
              <select name="fulfillmentType" defaultValue={filters.fulfillmentType} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {Object.entries(fulfillLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Төлем статусы", "Статус оплаты")}>
              <select name="paymentStatus" defaultValue={filters.paymentStatus} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {Object.entries(payStatusLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Дереккөз", "Источник")}>
              <input name="source" defaultValue={filters.source} className={inputClass} />
            </Field>
            <Field label={t("Көлік маркасы", "Марка авто")}>
              <input name="vehicleBrand" defaultValue={filters.vehicleBrand} className={inputClass} />
            </Field>
            <Field label={t("Қала", "Город")}>
              <input name="city" defaultValue={filters.city} className={inputClass} />
            </Field>
            <Field label={t("Бастап", "С")}>
              <input type="date" name="dateFrom" defaultValue={filters.dateFrom} className={inputClass} />
            </Field>
            <Field label={t("Дейін", "По")}>
              <input type="date" name="dateTo" defaultValue={filters.dateTo} className={inputClass} />
            </Field>
            <div className="flex items-end">
              <button type="submit" className="w-full rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                {t("Сүзу", "Фильтр")}
              </button>
            </div>
          </form>
        </Card>

        <Card title={t(`Заказдар (${orders.length})`, `Заказы (${orders.length})`)}>
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">{t("Заказ жоқ", "Заказов нет")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-3 pr-4 font-semibold">{t("Заказ №", "Заказ №")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Дата", "Дата")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Клиент", "Клиент")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Телефон", "Телефон")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Көлік", "Авто")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Тауар", "Товар")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Менеджер", "Менеджер")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Сома", "Сумма")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Төленген", "Оплачено")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Өндіріс", "Производство")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Жеткізу түрі", "Тип доставки")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Статус", "Статус")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Төлем", "Оплата")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("Мерзімі", "Срок")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const isOverdue = o.deadline && o.deadline < new Date() && !["COMPLETED", "CANCELLED"].includes(o.status);
                    return (
                      <tr key={o.id} className="border-t border-border align-top hover:bg-page-bg/50">
                        <td className="py-3 pr-4">
                          <Link href={`/orders/${o.id}`} className="font-semibold text-accent hover:underline">
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">{dateFmt.format(o.createdAt)}</td>
                        <td className="py-3 pr-4 text-text-primary">{o.customer.fullName}</td>
                        <td className="py-3 pr-4 text-text-secondary">{o.customer.phone}</td>
                        <td className="py-3 pr-4 text-text-secondary">{o.vehicle ? `${o.vehicle.make} ${o.vehicle.model}` : "—"}</td>
                        <td className="py-3 pr-4 text-text-secondary">{o.items.map((i) => i.product.name).join(", ") || "—"}</td>
                        <td className="py-3 pr-4 text-text-secondary">{o.salesManager.fullName}</td>
                        <td className="py-3 pr-4 font-semibold tabular-nums text-text-primary">{formatTenge(o.finalAmount)}</td>
                        <td className="py-3 pr-4 tabular-nums text-text-secondary">{formatTenge(o.paidAmount)}</td>
                        <td className="py-3 pr-4 text-text-secondary">{orderProductionStatus(o)}</td>
                        <td className="py-3 pr-4 text-text-secondary">{o.fulfillmentType ? fulfillLabel[o.fulfillmentType] : "—"}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{statusLabel[o.status]}</StatusBadge>
                        </td>
                        <td className="py-3 pr-4">
                          {(() => {
                            const ps = paymentStatus(o);
                            return <StatusBadge tone={PAYMENT_STATUS_TONE[ps]}>{payStatusLabel[ps]}</StatusBadge>;
                          })()}
                        </td>
                        <td className={`py-3 pr-4 ${isOverdue ? "font-bold text-danger" : "text-text-secondary"}`}>
                          {o.deadline ? dateFmt.format(o.deadline) : "—"} {isOverdue && `⚠ ${t("МЕРЗІМІ ӨТТІ", "СРОК ПРОШЁЛ")}`}
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
