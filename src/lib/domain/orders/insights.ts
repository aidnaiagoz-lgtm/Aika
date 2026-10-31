import { prisma } from "@/lib/db";

export type InsightLevel = "critical" | "warning" | "info";
export interface OrderInsight {
  level: InsightLevel;
  title: string;
  body: string;
}

type OrderForInsights = {
  id: string;
  status: string;
  deadline: Date | null;
  finalAmount: unknown;
  paidAmount: unknown;
  discountAmount: unknown;
  customerId: string;
  customer: { isVip: boolean; fullName: string };
  vehicle: { vin: string | null; licensePlate: string | null } | null;
  items: Array<{ productCategory: string | null; configuration: unknown | null }>;
  productionOrders: Array<{ qualityChecks: Array<{ result: string }> }>;
};

/** §45 — AI Order Assistant. ANTHROPIC_API_KEY жоқ болғандықтан (Console уақытша
 *  қолжетімсіз), нағыз AI шақыруының орнына rules-engine негізінде "ақылды кеңес"
 *  береді. API кілт пайда болғанда осы функцияны LLM шақыруымен алмастыруға болады —
 *  сыртқы интерфейс (OrderInsight[]) өзгермейді. */
export async function getOrderInsights(order: OrderForInsights): Promise<OrderInsight[]> {
  const insights: OrderInsight[] = [];
  const isTerminal = ["COMPLETED", "CANCELLED", "RETURNED"].includes(order.status);
  const finalAmount = Number(order.finalAmount);
  const paidAmount = Number(order.paidAmount);
  const discountAmount = Number(order.discountAmount);
  const debt = finalAmount - paidAmount;

  if (order.deadline && !isTerminal) {
    const daysLeft = Math.ceil((order.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysLeft < 0) {
      insights.push({
        level: "critical",
        title: "Мерзімі өтіп кетті",
        body: `Дедлайн ${Math.abs(daysLeft)} күн бұрын өтті. Клиентке хабарласып, жаңа мерзім келісу керек.`,
      });
    } else if (daysLeft <= 2 && !["READY", "WAITING_INSTALLATION", "WAITING_DELIVERY", "IN_DELIVERY"].includes(order.status)) {
      insights.push({
        level: "warning",
        title: "Мерзімге аз қалды",
        body: `Дедлайнға ${daysLeft} күн қалды, ал заказ әлі "${order.status}" статусында — өндірісті жеделдету қажет болуы мүмкін.`,
      });
    }
  }

  if (debt > 0 && order.status === "COMPLETED") {
    insights.push({
      level: "warning",
      title: "Аяқталған заказда борыш бар",
      body: `Клиентте ${new Intl.NumberFormat("ru-RU").format(debt)} ₸ борыш қалды.`,
    });
  }

  if (finalAmount > 0) {
    const discountPct = (discountAmount / (finalAmount + discountAmount)) * 100;
    if (discountPct >= 10) {
      insights.push({
        level: "info",
        title: "Жоғары скидка",
        body: `Бұл заказға ${discountPct.toFixed(1)}% скидка берілген — рентабельділікті тексеріңіз.`,
      });
    }
  }

  const hasRework = order.productionOrders.some((po) => po.qualityChecks.some((q) => q.result === "REWORK_REQUIRED"));
  if (hasRework) {
    insights.push({
      level: "warning",
      title: "Rework тарихы бар",
      body: "Бұл заказдың бір бөлігі QC-ден өтпей, қайта өңдеуге қайтарылған. Мерзімге әсер етуі мүмкін.",
    });
  }

  const missingConfig = order.items.filter((i) => i.productCategory === "Автополик" && !i.configuration);
  if (missingConfig.length > 0 && !isTerminal) {
    insights.push({
      level: "warning",
      title: "Конфигурация толтырылмаған",
      body: `${missingConfig.length} тауар үшін комплектация/материал әлі көрсетілмеген — растау кезінде бөгет болады.`,
    });
  }

  if (order.customer.isVip) {
    insights.push({
      level: "info",
      title: "VIP клиент",
      body: `${order.customer.fullName} — VIP клиент, қызмет сапасына ерекше көңіл бөліңіз.`,
    });
  }

  if (order.vehicle && !order.vehicle.vin && !order.vehicle.licensePlate) {
    insights.push({
      level: "info",
      title: "Көлік мәліметі толық емес",
      body: "VIN немесе мемлекеттік нөмір көрсетілмеген — болашақта қайта тапсырыс кезінде іздеу қиындатады.",
    });
  }

  const pastProblemOrders = await prisma.order.count({
    where: { customerId: order.customerId, id: { not: order.id }, status: { in: ["CANCELLED", "RETURNED"] } },
  });
  if (pastProblemOrders > 0) {
    insights.push({
      level: "warning",
      title: "Клиенттің тарихы бар",
      body: `Бұл клиенттің бұрын ${pastProblemOrders} болдырылмаған/қайтарылған заказы болған — ерекше назар аударыңыз.`,
    });
  }

  return insights;
}
