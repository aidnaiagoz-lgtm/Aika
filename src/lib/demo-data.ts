// Phase 0 dashboard demo data. §34 талабы бойынша production data-дан бөлек
// ұсталады — Sales/Orders модульдері (Phase 1) қосылғанда бұл файл нақты
// Prisma aggregation query-лерге ауыстырылады, ал беттегі компоненттер өзгермейді.

import type { Locale } from "@/lib/i18n";
import { tr } from "@/lib/tr";

export const kpiSummary = {
  salesToday: { value: 12_450_000, deltaPct: 16.8 },
  salesMonth: { value: 312_540_000, deltaPct: 22.4 },
  profitMonth: { value: 78_540_000, deltaPct: 15.3 },
  ordersCount: { value: 1245, deltaPct: 12.7 },
  aiForecast: { value: 350_000_000, deltaPct: 18.2 },
};

export function getSalesTrend(locale: Locale) {
  const dates = tr(locale, { kk: "16 мам,17 мам,18 мам,19 мам,20 мам,21 мам,22 мам", ru: "16 мая,17 мая,18 мая,19 мая,20 мая,21 мая,22 мая" }).split(",");
  const values = [3_100_000, 4_300_000, 6_600_000, 5_000_000, 6_800_000, 6_400_000, 9_500_000];
  return dates.map((date, i) => ({ date, value: values[i] }));
}

export function getTopProducts(locale: Locale) {
  return [
    { name: tr(locale, { kk: "3D Eva кілемше", ru: "3D Eva коврик" }), value: 4_250_000 },
    { name: tr(locale, { kk: "Багажник төсеніші", ru: "Коврик в багажник" }), value: 2_980_000 },
    { name: tr(locale, { kk: "Автокорпадағ аксессуар", ru: "Аксессуар для салона" }), value: 1_870_000 },
    { name: tr(locale, { kk: "Дөңгелек асты кілемше", ru: "Коврик в багажник" }), value: 1_560_000 },
    { name: tr(locale, { kk: "Подлокотник", ru: "Подлокотник" }), value: 1_230_000 },
  ];
}

export function getOrderStatusBreakdown(locale: Locale) {
  return [
    { key: "new", label: tr(locale, { kk: "Жаңа", ru: "Новые" }), count: 320, tone: "new" as const },
    { key: "processing", label: tr(locale, { kk: "Өнделуде", ru: "В обработке" }), count: 540, tone: "processing" as const },
    { key: "shipping", label: tr(locale, { kk: "Жеткізуде", ru: "В доставке" }), count: 210, tone: "shipping" as const },
    { key: "success", label: tr(locale, { kk: "Орнатылды", ru: "Установлено" }), count: 95, tone: "success" as const },
    { key: "done", label: tr(locale, { kk: "Аяқталды", ru: "Завершено" }), count: 80, tone: "neutral" as const },
  ];
}

export function getRecentOrders(locale: Locale) {
  return [
    { id: "#T-12545", customer: "Toyota Camry 70", product: tr(locale, { kk: "3D Eva кілемше", ru: "3D Eva коврик" }), amount: 120_000, status: "new" as const },
    { id: "#T-12544", customer: "Hyundai Tucson 2021", product: tr(locale, { kk: "Багажник төсеніші", ru: "Коврик в багажник" }), amount: 98_000, status: "processing" as const },
    { id: "#T-12543", customer: "Kia Sportage 2022", product: tr(locale, { kk: "Автокорпадағ аксессуар", ru: "Аксессуар для салона" }), amount: 115_000, status: "shipping" as const },
    { id: "#T-12542", customer: "BMW X5 2020", product: tr(locale, { kk: "Дөңгелек асты кілемше", ru: "Коврик в багажник" }), amount: 130_000, status: "success" as const },
  ];
}

export function getSecondaryStats(locale: Locale) {
  return [
    { label: tr(locale, { kk: "Орташа чек", ru: "Средний чек" }), value: "45 230 ₸", deltaPct: 7.3 },
    { label: tr(locale, { kk: "Маржа (ай)", ru: "Маржа (мес.)" }), value: "25.1%", deltaPct: 3.2 },
    { label: tr(locale, { kk: "Конверсия", ru: "Конверсия" }), value: "8.42%", deltaPct: 1.8 },
    { label: tr(locale, { kk: "Клиенттер", ru: "Клиенты" }), value: "8 542", deltaPct: 8.3 },
    { label: tr(locale, { kk: "Қайтарым", ru: "Возврат" }), value: "142 500 000 ₸", deltaPct: 5.1 },
    { label: tr(locale, { kk: "Қызметкерлер", ru: "Сотрудники" }), value: "156", deltaPct: 2.0 },
  ];
}

export function getAiRecommendations(locale: Locale) {
  return tr(locale, {
    kk: "Қоймада 3D Eva кілемшесінің қоры аз. Қосымша тапсырыс беру ұсынылады.|Маркетинг бюджетін Instagram жарнамасына көбейту ROI-ді арттырады.|Клиенттерге арналған акция жасаңыз – қайталама сатылым өседі.",
    ru: "На складе мало 3D Eva ковриков. Рекомендуется дозаказ.|Увеличение бюджета на рекламу в Instagram повысит ROI.|Запустите акцию для клиентов — это увеличит повторные продажи.",
  }).split("|");
}

export function formatTenge(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}
