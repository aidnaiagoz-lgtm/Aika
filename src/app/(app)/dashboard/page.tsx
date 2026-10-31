import { TrendingUp, ShoppingBag, PieChart, ClipboardList, Bot } from "lucide-react";
import { Card, StatCard } from "@/lib/ui";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import {
  kpiSummary,
  getSalesTrend,
  getTopProducts,
  getOrderStatusBreakdown,
  getRecentOrders,
  getSecondaryStats,
  getAiRecommendations,
  formatTenge,
} from "@/lib/demo-data";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { OrdersDonut } from "@/components/dashboard/OrdersDonut";
import { TopProductsCard } from "@/components/dashboard/TopProductsCard";
import { RecentOrdersTable } from "@/components/dashboard/RecentOrdersTable";
import { AIHeroCard } from "@/components/dashboard/AIHeroCard";
import { AIRecommendationsCard } from "@/components/dashboard/AIRecommendationsCard";

const DOT_CLASSES: Record<string, string> = {
  new: "bg-status-new",
  processing: "bg-status-processing",
  shipping: "bg-status-shipping",
  success: "bg-status-success",
  neutral: "bg-status-neutral",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const firstName = (user?.employee?.fullName ?? "Едил").split(" ")[0];

  const salesTrend = getSalesTrend(locale);
  const topProducts = getTopProducts(locale);
  const orderStatusBreakdown = getOrderStatusBreakdown(locale);
  const recentOrders = getRecentOrders(locale);
  const secondaryStats = getSecondaryStats(locale);
  const aiRecommendations = getAiRecommendations(locale);

  function statusLabel(status: string): string {
    const found = orderStatusBreakdown.find((s) => s.key === status);
    return found?.label ?? status;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t("Сатылым (бүгін)", "Продажи (сегодня)")} value={formatTenge(kpiSummary.salesToday.value)} deltaPct={kpiSummary.salesToday.deltaPct} icon={TrendingUp} tint="blue" />
        <StatCard label={t("Сатылым (ай)", "Продажи (мес.)")} value={formatTenge(kpiSummary.salesMonth.value)} deltaPct={kpiSummary.salesMonth.deltaPct} icon={ShoppingBag} />
        <StatCard label={t("Пайда (ай)", "Прибыль (мес.)")} value={formatTenge(kpiSummary.profitMonth.value)} deltaPct={kpiSummary.profitMonth.deltaPct} icon={PieChart} />
        <StatCard label={t("Тапсырыстар", "Заказы")} value={new Intl.NumberFormat("ru-RU").format(kpiSummary.ordersCount.value)} deltaPct={kpiSummary.ordersCount.deltaPct} icon={ClipboardList} />
        <StatCard label={t("AI болжам (ай соңына)", "AI-прогноз (к концу мес.)")} value={formatTenge(kpiSummary.aiForecast.value)} deltaPct={kpiSummary.aiForecast.deltaPct} deltaLabel={t("болжам", "прогноз")} icon={Bot} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t("Сатылым динамикасы (соңғы 7 күн)", "Динамика продаж (7 дней)")} className="lg:col-span-1">
          <SalesChart data={salesTrend} tooltipLabel={t("Сатылым", "Продажи")} />
        </Card>
        <TopProductsCard products={topProducts} title={t("Топ тауарлар", "Топ товары")} />
        <Card title={t("Тапсырыстар статусы", "Статус заказов")}>
          <div className="flex items-center gap-6">
            <OrdersDonut data={orderStatusBreakdown} total={orderStatusBreakdown.reduce((s, d) => s + d.count, 0)} totalLabel={t("Барлығы", "Всего")} />
            <ul className="flex flex-1 flex-col gap-2.5">
              {orderStatusBreakdown.map((s) => (
                <li key={s.key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-text-primary">
                    <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[s.tone]}`} />
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums text-text-primary">
                    {s.count}{" "}
                    <span className="font-normal text-text-secondary">
                      ({Math.round((s.count / 1245) * 100)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentOrdersTable
          orders={recentOrders.map((o) => ({ ...o, statusLabel: statusLabel(o.status) }))}
          title={t("Соңғы тапсырыстар", "Последние заказы")}
          viewAllLabel={t("Барлығын көру →", "Смотреть все →")}
          columns={{
            orderNo: t("№ тапсырыс", "№ заказа"),
            customer: t("Клиент", "Клиент"),
            product: t("Тауар", "Товар"),
            amount: t("Сумма", "Сумма"),
            status: t("Статус", "Статус"),
          }}
        />
        <AIHeroCard
          userName={firstName}
          title={t("AI Ассистент", "AI-ассистент")}
          greeting={t("Сәлеметсіз бе", "Здравствуйте")}
          message={t(
            `Сатылымның өткен айымен салыстырғанда ${kpiSummary.salesMonth.deltaPct}% өсті. Ең көп сұранысы 3D Eva кілемшелерге. Болжам бойынша ай соңында сатылым ${formatTenge(kpiSummary.aiForecast.value)} болады.`,
            `Продажи выросли на ${kpiSummary.salesMonth.deltaPct}% по сравнению с прошлым месяцем. Наибольший спрос на коврики 3D Eva. По прогнозу, к концу месяца продажи составят ${formatTenge(kpiSummary.aiForecast.value)}.`
          )}
          ctaLabel={t("Толық аналитикаға өту →", "Перейти к полной аналитике →")}
        />
        <AIRecommendationsCard items={aiRecommendations} title={t("AI ұсыныстары", "AI-рекомендации")} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {secondaryStats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} deltaPct={s.deltaPct} compact />
        ))}
      </div>
    </div>
  );
}
