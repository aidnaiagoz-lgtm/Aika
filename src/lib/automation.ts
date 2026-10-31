import "server-only";
import { prisma } from "@/lib/db";
import { subscribe } from "@/lib/events";

function formatTenge(value: number | { toString(): string }): string {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value))} ₸`;
}

// §24 Automation Engine: домендік event-терге жазылатын жалғыз орын.
// Жаңа модуль (Production, Warehouse...) қосылған сайын осында жаңа subscribe() қосылады —
// Sales қабатының өзі қалған модульдерді білмейді (event-driven decoupling).
let registered = false;

export function registerAutomations() {
  if (registered) return; // Next dev HMR-де қайта тіркелмеу үшін
  registered = true;

  subscribe("discount.requested", async (event) => {
    if (event.type !== "discount.requested") return;
    const deal = await prisma.deal.findUnique({ where: { id: event.dealId }, include: { customer: true } });
    if (!deal) return;
    const salesDept = await prisma.department.findUnique({ where: { slug: "sales" } });
    await prisma.notification.create({
      data: {
        departmentId: salesDept?.id,
        level: "WARNING",
        type: "discount_requested",
        title: `${event.requestedPct}% жеңілдік сұралды`,
        body: `${deal.customer.fullName} мәмілесі бойынша (${formatTenge(deal.amount)}) бекітуді қажет етеді.`,
        payload: { dealId: deal.id, discountRequestId: event.discountRequestId },
      },
    });
  });

  subscribe("discount.decided", async (event) => {
    if (event.type !== "discount.decided") return;
    const request = await prisma.discountRequest.findUnique({
      where: { id: event.discountRequestId },
      include: { requestedBy: { include: { user: true } } },
    });
    if (!request) return;
    await prisma.notification.create({
      data: {
        recipientId: request.requestedBy.user.id,
        level: event.approved ? "INFO" : "WARNING",
        type: "discount_decided",
        title: event.approved ? "Жеңілдік бекітілді" : "Жеңілдік қабылданбады",
        body: `Сұралған ${request.requestedPct}% жеңілдік ${event.approved ? "бекітілді" : "қабылданбады"}.`,
        payload: { dealId: event.dealId },
      },
    });
  });

  // §39 — Order Module notifications
  subscribe("order.created", async (event) => {
    if (event.type !== "order.created") return;
    const order = await prisma.order.findUnique({ where: { id: event.orderId }, include: { customer: true, salesManager: { include: { user: true } } } });
    if (!order) return;
    const salesDept = await prisma.department.findUnique({ where: { slug: "sales" } });
    await prisma.notification.create({
      data: {
        departmentId: salesDept?.id,
        level: "INFO",
        type: "order_created",
        title: `Жаңа заказ: ${order.orderNumber}`,
        body: `${order.customer.fullName} · ${order.salesManager.fullName} · ${formatTenge(order.finalAmount)}`,
        payload: { orderId: order.id },
      },
    });
  });

  subscribe("order.discount_requested", async (event) => {
    if (event.type !== "order.discount_requested") return;
    const order = await prisma.order.findUnique({ where: { id: event.orderId }, include: { customer: true } });
    if (!order) return;
    const salesDept = await prisma.department.findUnique({ where: { slug: "sales" } });
    await prisma.notification.create({
      data: {
        departmentId: salesDept?.id,
        level: "WARNING",
        type: "order_discount_requested",
        title: `${event.requestedPct}% жеңілдік сұралды (${order.orderNumber})`,
        body: `${order.customer.fullName} заказы бойынша (${formatTenge(order.finalAmount)}) бекітуді қажет етеді.`,
        payload: { orderId: order.id, discountRequestId: event.discountRequestId },
      },
    });
  });

  subscribe("order.payment_added", async (event) => {
    if (event.type !== "order.payment_added") return;
    const order = await prisma.order.findUnique({ where: { id: event.orderId }, include: { salesManager: { include: { user: true } } } });
    if (!order) return;
    await prisma.notification.create({
      data: {
        recipientId: order.salesManager.user.id,
        level: "INFO",
        type: "order_payment_added",
        title: `Төлем қосылды: ${order.orderNumber}`,
        body: `${formatTenge(event.amount)} төленді.`,
        payload: { orderId: order.id },
      },
    });
  });

  subscribe("order.status_changed", async (event) => {
    if (event.type !== "order.status_changed") return;
    const order = await prisma.order.findUnique({ where: { id: event.orderId }, include: { salesManager: { include: { user: true } } } });
    if (!order) return;

    if (event.toStatus === "READY") {
      await prisma.notification.create({
        data: {
          recipientId: order.salesManager.user.id,
          level: "INFO",
          type: "order_ready",
          title: `Тауар дайын: ${order.orderNumber}`,
          body: "Клиентке хабарласу керек.",
          payload: { orderId: order.id },
        },
      });
    }
    if (event.toStatus === "WAITING_INSTALLATION" || event.toStatus === "WAITING_DELIVERY") {
      const deptSlug = event.toStatus === "WAITING_INSTALLATION" ? "logistics" : "logistics";
      const dept = await prisma.department.findUnique({ where: { slug: deptSlug } });
      await prisma.notification.create({
        data: {
          departmentId: dept?.id,
          level: "INFO",
          type: "order_fulfillment_waiting",
          title: `${order.orderNumber} — ${event.toStatus === "WAITING_INSTALLATION" ? "орнатуды" : "доставканы"} күтуде`,
          payload: { orderId: order.id },
        },
      });
    }
  });

  subscribe("order.qc_rework_required", async (event) => {
    if (event.type !== "order.qc_rework_required") return;
    const order = await prisma.order.findUnique({ where: { id: event.orderId }, include: { salesManager: { include: { user: true } } } });
    if (!order) return;
    const productionDept = await prisma.department.findUnique({ where: { slug: "production" } });
    await prisma.notification.create({
      data: {
        departmentId: productionDept?.id,
        level: "WARNING",
        type: "order_qc_rework_required",
        title: `Қайта өңдеу керек: ${order.orderNumber}`,
        body: event.comment ?? "QC тексерісінен REWORK нәтижесі шықты.",
        payload: { orderId: order.id, productionOrderId: event.productionOrderId },
      },
    });
    await prisma.notification.create({
      data: {
        recipientId: order.salesManager.user.id,
        level: "WARNING",
        type: "order_qc_rework_required",
        title: `Қайта өңдеу керек: ${order.orderNumber}`,
        body: "Цех QC тексерісінен REWORK нәтижесі шықты, мерзім ұзаруы мүмкін.",
        payload: { orderId: order.id, productionOrderId: event.productionOrderId },
      },
    });
  });

  subscribe("deal.paid", async (event) => {
    if (event.type !== "deal.paid") return;
    const salesDept = await prisma.department.findUnique({ where: { slug: "sales" } });
    await prisma.notification.create({
      data: {
        departmentId: salesDept?.id,
        level: "INFO",
        type: "deal_paid",
        title: "Мәміле төленді",
        body: `Тапсырыс ${formatTenge(event.amount)} сомасына төленді. Өндіріс модулі қосылғанда бұл жерден автоматты queue ашылады.`,
        payload: { dealId: event.dealId },
      },
    });
  });
}
