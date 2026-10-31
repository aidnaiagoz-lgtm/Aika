import Link from "next/link";
import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getManagerKpis, getProductionKpis, getInstallationKpis, getBusinessAnalytics } from "@/lib/domain/orders";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { formatTenge } from "@/lib/order-labels";

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export default async function OrdersAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const filters = await searchParams;
  const noData = t("Дерек жоқ", "Нет данных");

  try {
    const [managerKpis, productionKpis, installationKpis, business] = await Promise.all([
      getManagerKpis(user, filters),
      getProductionKpis(user, filters),
      getInstallationKpis(user, filters),
      getBusinessAnalytics(user, filters),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">{t("Аналитика / KPI", "Аналитика / KPI")}</h1>
          <Link href="/orders" className="text-sm font-medium text-accent hover:underline">
            {t("← Заказдарға оралу", "← Назад к заказам")}
          </Link>
        </div>

        <Card title={t("Кезең", "Период")}>
          <form className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{t("Бастап", "С")}</label>
              <input type="date" name="dateFrom" defaultValue={filters.dateFrom} className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{t("Дейін", "По")}</label>
              <input type="date" name="dateTo" defaultValue={filters.dateTo} className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
              {t("Сүзу", "Фильтр")}
            </button>
          </form>
        </Card>

        {/* §44 — Business Analytics overview */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label={t("Заказдар", "Заказы")} value={String(business.orderCount)} />
          <Kpi label={t("Кіріс", "Доход")} value={formatTenge(business.revenue)} />
          <Kpi label={t("Орташа чек", "Средний чек")} value={formatTenge(business.avgCheck)} />
          <Kpi label={t("Скидка деңгейі", "Уровень скидки")} value={pct(business.discountRate)} />
          <Kpi label={t("Борыш", "Долг")} value={formatTenge(business.outstandingDebt)} />
          <Kpi label={t("Қайталама сатып алу", "Повторные покупки")} value={pct(business.repeatPurchaseRate)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={t("Кіріс — менеджер бойынша", "Доход — по менеджеру")}>
            <RankTable rows={business.byManager} noData={noData} />
          </Card>
          <Card title={t("Кіріс — дереккөз бойынша", "Доход — по источнику")}>
            <RankTable rows={business.bySource} noData={noData} />
          </Card>
          <Card title={t("Кіріс — филиал бойынша", "Доход — по филиалу")}>
            <RankTable rows={business.byBranch} noData={noData} />
          </Card>
          <Card title={t("Кіріс — көлік маркасы бойынша", "Доход — по марке авто")}>
            <RankTable rows={business.byVehicleBrand} noData={noData} />
          </Card>
          <Card title={t("Топ тауарлар (саны бойынша)", "Топ товары (по кол-ву)")}>
            <RankTable rows={business.topProducts.map((p) => ({ key: p.name, value: p.qty }))} unit={t("дана", "шт")} noData={noData} />
          </Card>
          <Card title={t("Топ көлік модельдері", "Топ моделей авто")}>
            <RankTable rows={business.topVehicleModels.map((v) => ({ key: v.name, value: v.count }))} unit={t("заказ", "заказ")} noData={noData} />
          </Card>
        </div>

        {/* §41 — Manager KPI */}
        <Card title={t("Менеджер KPI", "Менеджер KPI")}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-text-secondary">
                  <th className="pb-2 pr-4 font-semibold">{t("Менеджер", "Менеджер")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Құрылды", "Создано")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Расталды", "Подтверждено")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Кіріс", "Доход")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Орташа чек", "Средний чек")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Скидка %", "Скидка %")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Төленген заказ", "Оплаченные заказы")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Төленбеген", "Не оплачено")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Болдырылмау %", "Отмены %")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Қайтару %", "Возвраты %")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Қайталама клиент", "Повторные клиенты")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Тауар/заказ", "Товар/заказ")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("Конверсия", "Конверсия")}</th>
                </tr>
              </thead>
              <tbody>
                {managerKpis.map((m) => (
                  <tr key={m.managerId} className="border-t border-border">
                    <td className="py-2 pr-4 font-medium text-text-primary">{m.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{m.created}</td>
                    <td className="py-2 pr-4 tabular-nums">{m.confirmed}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatTenge(m.revenue)}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatTenge(m.avgCheck)}</td>
                    <td className="py-2 pr-4 tabular-nums">{pct(m.discountPct)}</td>
                    <td className="py-2 pr-4 tabular-nums">{m.paidOrders}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatTenge(m.unpaidBalance)}</td>
                    <td className="py-2 pr-4 tabular-nums">{pct(m.cancellationPct)}</td>
                    <td className="py-2 pr-4 tabular-nums">{pct(m.returnPct)}</td>
                    <td className="py-2 pr-4 tabular-nums">{m.repeatClients}</td>
                    <td className="py-2 pr-4 tabular-nums">{m.productsPerOrder.toFixed(1)}</td>
                    <td className="py-2 pr-4 tabular-nums">{pct(m.conversionPct)}</td>
                  </tr>
                ))}
                {managerKpis.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-4 text-center text-text-secondary">
                      {noData}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* §42 — Production KPI */}
        <Card title={t("Өндіріс KPI", "Производство KPI")}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label={t("Дайын болды", "Готово")} value={String(productionKpis.produced)} />
            <Kpi label={t("Орташа өндіру уақыты", "Среднее время производства")} value={`${productionKpis.avgProductionHours.toFixed(1)} ${t("сағ", "ч")}`} />
            <Kpi label={t("Кешіккен", "Просрочено")} value={String(productionKpis.delayed)} />
            <Kpi label={t("Брак деңгейі", "Уровень брака")} value={pct(productionKpis.defectRate)} />
            <Kpi label={t("Қайта жасау деңгейі", "Уровень переделок")} value={pct(productionKpis.reworkRate)} />
          </div>
          {productionKpis.workerProductivity.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t("Жұмысшы өнімділігі", "Продуктивность работников")}</p>
              <RankTable rows={productionKpis.workerProductivity.map((w) => ({ key: w.name, value: w.count }))} unit={t("дайын", "готово")} noData={noData} />
            </div>
          )}
        </Card>

        {/* §43 — Installation KPI */}
        <Card title={t("Орнату KPI", "Установка KPI")}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label={t("Күніне орнату", "Установок в день")} value={installationKpis.perDay.toFixed(1)} />
            <Kpi label={t("Орташа уақыт", "Среднее время")} value={`${installationKpis.avgHours.toFixed(1)} ${t("сағ", "ч")}`} />
            <Kpi label={t("Қайта жасау %", "Переделки %")} value={pct(installationKpis.reworkPct)} />
            <Kpi label={t("Уақытында орындалды", "Выполнено вовремя")} value={pct(installationKpis.onTimePct)} />
            <Kpi label={t("Шағым %", "Жалобы %")} value={noData} hint={t("Шағымдар модулі әлі жоқ", "Модуль жалоб пока не создан")} />
          </div>
        </Card>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-icon border border-border bg-page-bg p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-bold text-text-primary">{value}</p>
      {hint && <p className="text-[10px] text-text-secondary">{hint}</p>}
    </div>
  );
}

function RankTable({ rows, unit, noData }: { rows: { key: string; value: number }[]; unit?: string; noData: string }) {
  if (rows.length === 0) return <p className="text-sm text-text-secondary">{noData}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {rows.slice(0, 10).map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate text-text-secondary">{r.key}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums text-text-primary">
            {unit ? `${r.value} ${unit}` : formatTenge(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
