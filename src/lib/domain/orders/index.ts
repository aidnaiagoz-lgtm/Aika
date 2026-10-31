import { prisma, PermissionAction, type Prisma } from "@/lib/db";
import { assertPermission, scopeWhere } from "@/lib/rbac";
import { publish } from "@/lib/events";
import type { ActingUser, CreateOrderInput } from "./types";

export * from "./types";
export * from "./analytics";
export * from "./insights";

// §10 — рөл бойынша скидка лимиті (%). Тізімде жоқ рөл = 0% (өз бетімен скидка бермейді).
const DISCOUNT_LIMIT_PCT: Record<string, number> = {
  SALES_MANAGER: 5,
  SENIOR_SALES_MANAGER: 10,
  DEPARTMENT_HEAD: 15,
  CEO: Infinity,
  ADMIN: Infinity,
};

function maxDiscountPct(user: ActingUser): number {
  let max = 0;
  for (const ur of user.userRoles) {
    const limit = DISCOUNT_LIMIT_PCT[ur.role.name];
    if (limit !== undefined && limit > max) max = limit;
  }
  return max;
}

export async function listProducts() {
  return prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function listMaterials() {
  return prisma.material.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

/** AM-2026-000154 форматы. Дәл сол секунда 2 заказ бір мезгілде жасалса, теориялық қайталану
 *  тәуекелі бар (orderNumber @unique қорғайды, бірақ collision болса қайта шақыру керек болады) —
 *  бұл ауқымдағы қолмен енгізу жиілігінде бұл тәуекел елеусіз. */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.order.count({ where: { orderNumber: { startsWith: `AM-${year}-` } } });
  return `AM-${year}-${String(count + 1).padStart(6, "0")}`;
}

export async function listOrders(
  user: ActingUser,
  filters: {
    status?: string;
    search?: string;
    branchId?: string;
    source?: string;
    dateFrom?: string;
    dateTo?: string;
    managerId?: string;
    vehicleBrand?: string;
    productId?: string;
    city?: string;
    fulfillmentType?: string;
    paymentStatus?: string;
  } = {}
) {
  const scope = assertPermission(user, "orders", PermissionAction.VIEW);
  const where: Prisma.OrderWhereInput = {
    ...scopeWhere(user, scope, { ownerField: "salesManagerId", branchField: "branchId" }),
  };
  if (filters.status) where.status = filters.status as never;
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.source) where.source = filters.source;
  if (filters.managerId) where.salesManagerId = filters.managerId;
  if (filters.vehicleBrand) where.vehicle = { make: { contains: filters.vehicleBrand, mode: "insensitive" } };
  if (filters.productId) where.items = { some: { productId: filters.productId } };
  if (filters.city) where.customer = { city: { contains: filters.city, mode: "insensitive" } };
  if (filters.fulfillmentType) where.fulfillmentType = filters.fulfillmentType as never;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: "insensitive" } },
      { customer: { fullName: { contains: filters.search, mode: "insensitive" } } },
      { customer: { phone: { contains: filters.search } } },
      { vehicle: { licensePlate: { contains: filters.search, mode: "insensitive" } } },
      { vehicle: { model: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: true,
      vehicle: true,
      salesManager: true,
      items: { include: { product: true } },
      productionOrders: true,
      installation: true,
      delivery: true,
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // paymentStatus DB бағаны емес (есептелген), сондықтан JS деңгейінде сүземіз
  if (filters.paymentStatus) {
    return orders.filter((o) => paymentStatus(o) === filters.paymentStatus);
  }
  return orders;
}

export async function getOrderDetail(user: ActingUser, orderId: string) {
  assertPermission(user, "orders", PermissionAction.VIEW);
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      customer: { include: { contacts: true, cars: true } },
      vehicle: true,
      branch: true,
      createdBy: true,
      salesManager: true,
      items: { include: { product: true, car: true, configuration: { include: { material: true } } } },
      payments: { include: { employee: true }, orderBy: { paidAt: "desc" } },
      productionOrders: { include: { assignedWorker: true, qualityChecks: true } },
      installation: { include: { installer: true } },
      delivery: { include: { courier: true } },
      discountRequests: { include: { requestedBy: true, approvedBy: true }, orderBy: { createdAt: "desc" } },
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      statusHistory: { include: { changedBy: true }, orderBy: { changedAt: "asc" } },
    },
  });
}

export function paymentStatus(order: { finalAmount: unknown; paidAmount: unknown }): string {
  const final = Number(order.finalAmount);
  const paid = Number(order.paidAmount);
  if (paid <= 0) return "NOT_PAID";
  if (paid < final) return "PARTIALLY_PAID";
  if (paid === final) return "PAID";
  return "OVERPAID";
}

/** §33 тізім бағаны — заказдың ең "маңызды" production жазбасының статусы (болмаса "—"). */
export function orderProductionStatus(order: { productionOrders: Array<{ status: string }> }): string {
  if (order.productionOrders.length === 0) return "—";
  const priority = ["DEFECT", "REWORK", "QUALITY_CHECK", "LOGO", "EDGING", "ASSEMBLY", "CUTTING", "QUEUED", "READY", "NEW", "CANCELLED"];
  for (const status of priority) {
    if (order.productionOrders.some((po) => po.status === status)) return status;
  }
  return order.productionOrders[0].status;
}

export async function createOrder(user: ActingUser, input: CreateOrderInput) {
  assertPermission(user, "orders", PermissionAction.CREATE);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы заказ аша алады");
  if (input.items.length === 0) throw new Error("Кемінде бір тауар қосу керек");

  // §26 — Client duplicate protection: phone бойынша бар клиентті қолданамыз, дубль жасамаймыз
  let customerId = input.customerId;
  if (!customerId) {
    if (!input.newCustomer) throw new Error("Клиентті таңдау немесе жаңасын енгізу керек");
    const customer = await prisma.customer.upsert({
      where: { phone: input.newCustomer.phone },
      update: {},
      create: {
        fullName: input.newCustomer.fullName,
        phone: input.newCustomer.phone,
        whatsapp: input.newCustomer.whatsapp,
        city: input.newCustomer.city,
        clientType: input.newCustomer.clientType as never,
        isVip: input.newCustomer.isVip,
      },
    });
    customerId = customer.id;
  }

  let vehicleId = input.vehicleId ?? null;
  if (!vehicleId && input.newVehicle) {
    const vehicle = await prisma.customerCar.create({
      data: { customerId, ...input.newVehicle },
    });
    vehicleId = vehicle.id;
  }

  const products = await prisma.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
  const productById = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  let itemDiscountTotal = 0;
  const itemsData = input.items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new Error("Тауар табылмады");
    const basePrice = Number(product.basePrice);
    const discountAmount = item.discountAmount ?? 0;
    const unitPrice = basePrice - discountAmount;
    totalAmount += basePrice * item.qty;
    itemDiscountTotal += discountAmount * item.qty;
    return {
      productId: product.id,
      productCategory: product.category,
      productType: product.type,
      productClass: product.class,
      qty: item.qty,
      basePrice,
      discountAmount,
      unitPrice,
      comment: item.comment,
      configuration: item.configuration ? { create: item.configuration } : undefined,
    };
  });

  // §10 — order-level қосымша скидка (пайызбен), рөл лимитінен асса — approval сұралады, әзірге қолданылмайды
  const requestedPct = input.requestedDiscountPct ?? 0;
  const allowedPct = maxDiscountPct(user);
  const extraDiscountApplied = requestedPct > 0 && requestedPct <= allowedPct ? (totalAmount * requestedPct) / 100 : 0;
  const discountAmount = itemDiscountTotal + extraDiscountApplied;
  const finalAmount = totalAmount - discountAmount;

  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId,
      vehicleId,
      branchId: input.branchId ?? user.employee.branchId,
      createdById: user.employee.id,
      salesManagerId: user.employee.id,
      priority: (input.priority as never) ?? "NORMAL",
      source: input.source,
      salesChannel: input.salesChannel,
      certificateNo: input.certificateNo,
      managerBonus: input.managerBonus,
      comment: input.comment,
      fulfillmentType: input.fulfillmentType as never,
      deadline: input.deadline ? new Date(input.deadline) : undefined,
      totalAmount,
      discountAmount,
      finalAmount,
      status: "NEW",
      items: { create: itemsData },
      statusHistory: { create: { toStatus: "NEW", changedById: user.employee.id } },
    },
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "CREATE", entityType: "Order", entityId: order.id, newValue: { orderNumber, finalAmount } },
  });

  if (requestedPct > allowedPct) {
    await requestOrderDiscount(user, order.id, requestedPct);
  }

  publish({ type: "order.created", orderId: order.id, dealId: null });

  return order;
}

/** Sales pipeline-нен келетін ескі жол: Deal "ORDER" сатысына жеткенде осы арқылы Order
 *  жасалады (§ deals.ts). Жаңа "Заказ" модулінің createOrder-інен бөлек — мұнда client/vehicle
 *  Deal-дан белгілі болады, қайта сұрамайды. */
export async function createOrderFromDeal(
  user: ActingUser,
  dealId: string,
  items: { productId: string; qty: number }[]
) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы мәмілені заказға айналдыра алады");
  if (items.length === 0) throw new Error("Кемінде бір тауар таңдау керек");

  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const productById = new Map(products.map((p) => [p.id, p]));

  const discountMultiplier = 1 - Number(deal.discountPct) / 100;
  let totalAmount = 0;
  let discountAmount = 0;
  const orderItemsData = items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new Error("Тауар табылмады");
    const basePrice = Number(product.basePrice);
    const unitPrice = basePrice * discountMultiplier;
    totalAmount += basePrice * item.qty;
    discountAmount += (basePrice - unitPrice) * item.qty;
    return {
      productId: product.id,
      productCategory: product.category,
      productType: product.type,
      productClass: product.class,
      qty: item.qty,
      basePrice,
      discountAmount: basePrice - unitPrice,
      unitPrice,
      carId: deal.carId,
    };
  });
  const finalAmount = totalAmount - discountAmount;
  const orderNumber = await generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        dealId: deal.id,
        customerId: deal.customerId,
        vehicleId: deal.carId,
        branchId: deal.branchId,
        createdById: user.employee!.id,
        salesManagerId: deal.assignedToId,
        totalAmount,
        discountAmount,
        finalAmount,
        items: { createMany: { data: orderItemsData } },
        statusHistory: { create: { toStatus: "NEW", changedById: user.employee!.id } },
      },
    });
    await tx.deal.update({ where: { id: deal.id }, data: { amount: finalAmount } });
    return created;
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "CREATE", entityType: "Order", entityId: order.id, newValue: { dealId, finalAmount } },
  });

  publish({ type: "order.created", orderId: order.id, dealId });

  return order;
}

export async function recordFullPayment(user: ActingUser, orderId: string) {
  assertPermission(user, "deals", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const remaining = Number(order.finalAmount) - Number(order.paidAmount);
  if (remaining <= 0) throw new Error("Тапсырыс толық төленген");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.create({ data: { orderId, amount: remaining, status: "PAID", employeeId: user.employee?.id } });
    return tx.order.update({ where: { id: orderId }, data: { paidAmount: order.finalAmount } });
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "PAYMENT", entityType: "Order", entityId: orderId, newValue: { amount: remaining } },
  });

  publish({ type: "order.paid", orderId, dealId: order.dealId, amount: Number(order.finalAmount) });

  return updated;
}

export async function addPayment(
  user: ActingUser,
  orderId: string,
  input: { amount: number; method: string; cashbox?: string; transactionId?: string; receiptUrl?: string; comment?: string }
) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  if (input.amount <= 0) throw new Error("Төлем сомасы 0-ден көп болуы керек");

  const order = await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orderId,
        amount: input.amount,
        method: input.method as never,
        cashbox: input.cashbox,
        employeeId: user.employee?.id,
        transactionId: input.transactionId,
        receiptUrl: input.receiptUrl,
        comment: input.comment,
      },
    });
    return tx.order.update({ where: { id: orderId }, data: { paidAmount: { increment: input.amount } } });
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "PAYMENT", entityType: "Order", entityId: orderId, newValue: input as object },
  });

  publish({ type: "order.payment_added", orderId, amount: input.amount });
  if (Number(order.paidAmount) >= Number(order.finalAmount)) {
    publish({ type: "order.paid", orderId, dealId: order.dealId, amount: Number(order.finalAmount) });
  }

  return order;
}

export async function requestOrderDiscount(user: ActingUser, orderId: string, requestedPct: number) {
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы жеңілдік сұрай алады");
  const request = await prisma.orderDiscountRequest.create({
    data: { orderId, requestedById: user.employee.id, requestedPct },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "REQUEST", entityType: "OrderDiscountRequest", entityId: request.id, newValue: { requestedPct } },
  });
  publish({ type: "order.discount_requested", orderId, discountRequestId: request.id, requestedPct });
  return request;
}

export async function decideOrderDiscount(user: ActingUser, requestId: string, approve: boolean) {
  assertPermission(user, "orders", PermissionAction.APPROVE);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы жеңілдікті бекіте алады");

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.orderDiscountRequest.update({
      where: { id: requestId },
      data: { status: approve ? "APPROVED" : "REJECTED", approvedById: user.employee!.id, decidedAt: new Date() },
    });
    if (approve) {
      const order = await tx.order.findUniqueOrThrow({ where: { id: updated.orderId } });
      const extra = (Number(order.totalAmount) * Number(updated.requestedPct)) / 100;
      const newDiscount = Number(order.discountAmount) + extra;
      await tx.order.update({
        where: { id: order.id },
        data: { discountAmount: newDiscount, finalAmount: Number(order.totalAmount) - newDiscount },
      });
    }
    return updated;
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: approve ? "APPROVE" : "REJECT",
      entityType: "OrderDiscountRequest",
      entityId: requestId,
      newValue: request as object,
    },
  });

  return request;
}

// §19-20 — Order status automation
async function transitionOrderStatus(user: ActingUser, orderId: string, toStatus: string) {
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы статусты өзгерте алады");
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: toStatus as never } });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: current.status, toStatus: toStatus as never, changedById: user.employee!.id },
    });
    return updated;
  });
  publish({ type: "order.status_changed", orderId, toStatus });
  return order;
}

/** §25 — Order Confirm валидация. */
export async function confirmOrder(user: ActingUser, orderId: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { include: { configuration: true, product: true } },
      customer: true,
      delivery: true,
      installation: true,
      discountRequests: true,
    },
  });

  if (!order.vehicleId) throw new Error("Көлік таңдалмаған");
  if (order.items.length === 0) throw new Error("Тауар қосылмаған");
  if (Number(order.finalAmount) <= 0) throw new Error("Соңғы баға 0-ден көп болуы керек");
  if (!order.fulfillmentType) throw new Error("Жеткізу түрі (Installation/Delivery/Pickup) таңдалмаған");
  if (order.fulfillmentType === "DELIVERY" && !order.delivery?.address) throw new Error("Доставка мекенжайы міндетті");
  if (order.fulfillmentType === "INSTALLATION" && !order.installation?.date) throw new Error("Орнату күні/уақыты міндетті");
  if (order.discountRequests.some((r) => r.status === "PENDING")) throw new Error("Жеңілдік әлі бекітілмеген (WAITING APPROVAL)");

  // §25 — өндіріс қажет өнім (Автополик) үшін конфигурация міндетті
  const missingConfig = order.items.filter((i) => i.productCategory === "Автополик" && !i.configuration);
  if (missingConfig.length > 0) {
    throw new Error(`"${missingConfig[0].product.name}" үшін конфигурация (комплектация/материал) толтырылмаған`);
  }

  await transitionOrderStatus(user, orderId, "CONFIRMED");
  // §52 — Confirm Order автоматты: Production Order жасайды, notification/KPI event шығарады.
  return sendToProduction(user, orderId);
}

export async function sendToProduction(user: ActingUser, orderId: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

  await prisma.productionOrder.createMany({
    data: order.items.map((item) => ({ orderId, orderItemId: item.id, status: "NEW" as const })),
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "SEND_TO_PRODUCTION", entityType: "Order", entityId: orderId },
  });
  publish({ type: "order.production_started", orderId });

  return transitionOrderStatus(user, orderId, "IN_PRODUCTION");
}

/** IN_PRODUCTION → READY. Толық QC workflow (§15) — Production модулінің өз кезеңі;
 *  осы жерде тек Order-дың сыртқы статусы жаңарады. */
/** §15 — QC нәтижесін жазады. PASSED болса тиісті ProductionOrder READY болады,
 *  FAILED/REWORK_REQUIRED болса DEFECT/REWORK-ке ауысады. */
export async function recordQualityCheck(
  user: ActingUser,
  productionOrderId: string,
  result: "PASSED" | "FAILED" | "REWORK_REQUIRED",
  comment?: string
) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы QC жаза алады");

  await prisma.qualityControl.create({
    data: { productionOrderId, employeeId: user.employee.id, result, comment },
  });
  const nextStatus = result === "PASSED" ? "READY" : result === "REWORK_REQUIRED" ? "REWORK" : "DEFECT";
  const updated = await prisma.productionOrder.update({ where: { id: productionOrderId }, data: { status: nextStatus } });
  if (result === "REWORK_REQUIRED") {
    publish({ type: "order.qc_rework_required", orderId: updated.orderId, productionOrderId, comment });
  }
  return updated;
}

/** §15 — "QC PASSED болмайынша заказ READY FOR CLIENT статусына өте алмайды." */
export async function markOrderReady(user: ActingUser, orderId: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { productionOrders: { include: { qualityChecks: { orderBy: { date: "desc" }, take: 1 } } } },
  });
  const notPassed = order.productionOrders.filter((po) => po.qualityChecks[0]?.result !== "PASSED");
  if (order.productionOrders.length > 0 && notPassed.length > 0) {
    throw new Error(`QC өтпеген ${notPassed.length} өндіріс жазбасы бар — алдымен QC тексеру керек`);
  }
  return transitionOrderStatus(user, orderId, "READY");
}

/** Installation мәліметін жазады. Заказ құрылу кезінде шақырылса (әлі READY емес) статусты
 *  өзгертпейді — тек мәлімет сақталады; READY жеткенде ғана WAITING_INSTALLATION-ға өтеді. */
export async function scheduleInstallation(
  user: ActingUser,
  orderId: string,
  input: { date: string; installerId?: string; comment?: string }
) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  return prisma.installation.upsert({
    where: { orderId },
    update: { date: new Date(input.date), installerId: input.installerId, comment: input.comment },
    create: { orderId, date: new Date(input.date), installerId: input.installerId, comment: input.comment },
  });
}

export async function scheduleDelivery(
  user: ActingUser,
  orderId: string,
  input: { address: string; city?: string; phone?: string; deliveryDate?: string; courierId?: string }
) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  return prisma.delivery.upsert({
    where: { orderId },
    update: {
      address: input.address,
      city: input.city,
      phone: input.phone,
      deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
      courierId: input.courierId,
    },
    create: {
      orderId,
      address: input.address,
      city: input.city,
      phone: input.phone,
      deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
      courierId: input.courierId,
    },
  });
}

/** §16 — Installer орындау барысын жаңартады (IN_PROGRESS/COMPLETED + фото). */
export async function updateInstallationStatus(
  user: ActingUser,
  orderId: string,
  input: { status: string; beforePhotoUrl?: string; afterPhotoUrl?: string; comment?: string }
) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const now = new Date();
  const installation = await prisma.installation.update({
    where: { orderId },
    data: {
      status: input.status as never,
      startTime: input.status === "IN_PROGRESS" ? now : undefined,
      finishTime: input.status === "COMPLETED" ? now : undefined,
      beforePhotoUrl: input.beforePhotoUrl,
      afterPhotoUrl: input.afterPhotoUrl,
      comment: input.comment,
    },
  });
  if (input.status === "COMPLETED") await completeOrder(user, orderId);
  return installation;
}

/** §17 — Courier жеткізу барысын жаңартады. */
export async function updateDeliveryStatus(user: ActingUser, orderId: string, status: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const delivery = await prisma.delivery.update({ where: { orderId }, data: { status: status as never } });
  if (status === "DELIVERED") await completeOrder(user, orderId);
  return delivery;
}

/** READY/WAITING_INSTALLATION/WAITING_DELIVERY → COMPLETED (installer/courier "Completed" деп
 *  белгілегендей, §20). PICKUP үшін READY-ден тікелей шақырылады. */
export async function completeOrder(user: ActingUser, orderId: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  return transitionOrderStatus(user, orderId, "COMPLETED");
}

/** READY → fulfillmentType-ке сай келесі саты (§18, §20). Installation/Delivery мәліметі
 *  createOrder кезінде сақталған болса, осы жерде қайта сұралмайды. */
export async function advanceAfterReady(user: ActingUser, orderId: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.fulfillmentType === "INSTALLATION") return transitionOrderStatus(user, orderId, "WAITING_INSTALLATION");
  if (order.fulfillmentType === "DELIVERY") return transitionOrderStatus(user, orderId, "WAITING_DELIVERY");
  return transitionOrderStatus(user, orderId, "COMPLETED"); // PICKUP
}

export async function cancelOrder(user: ActingUser, orderId: string, reason?: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  if (reason) {
    await prisma.orderComment.create({
      data: { orderId, authorId: user.employee!.id, body: `Cancel reason: ${reason}` },
    });
  }
  return transitionOrderStatus(user, orderId, "CANCELLED");
}

/** §21 More — заказ клиентке жеткізілгеннен кейін қайтарылса. */
export async function returnOrder(user: ActingUser, orderId: string, reason?: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  if (reason) {
    await prisma.orderComment.create({
      data: { orderId, authorId: user.employee!.id, body: `Return reason: ${reason}` },
    });
  }
  return transitionOrderStatus(user, orderId, "RETURNED");
}

/** §21 More — сапа/клиент шағымы бойынша қайта жасауға жіберу. */
export async function reworkOrder(user: ActingUser, orderId: string, reason?: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  if (reason) {
    await prisma.orderComment.create({
      data: { orderId, authorId: user.employee!.id, body: `Rework reason: ${reason}` },
    });
  }
  return transitionOrderStatus(user, orderId, "REWORK");
}

/** §21 More — сол клиент/көлік/тауарлармен жаңа DRAFT заказ жасайды (қайталама тапсырыс). */
export async function duplicateOrder(user: ActingUser, orderId: string) {
  assertPermission(user, "orders", PermissionAction.CREATE);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы заказ аша алады");

  const source = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { configuration: true } } },
  });

  const orderNumber = await generateOrderNumber();
  const newOrder = await prisma.order.create({
    data: {
      orderNumber,
      customerId: source.customerId,
      vehicleId: source.vehicleId,
      branchId: source.branchId,
      createdById: user.employee.id,
      salesManagerId: user.employee.id,
      priority: source.priority,
      source: source.source,
      salesChannel: source.salesChannel,
      certificateNo: source.certificateNo,
      managerBonus: source.managerBonus ?? undefined,
      status: "DRAFT",
      totalAmount: source.totalAmount,
      discountAmount: source.discountAmount,
      finalAmount: source.finalAmount,
      comment: `Duplicate of ${source.orderNumber}`,
      items: {
        create: source.items.map((item) => ({
          productId: item.productId,
          productCategory: item.productCategory,
          productType: item.productType,
          productClass: item.productClass,
          qty: item.qty,
          basePrice: item.basePrice,
          discountAmount: item.discountAmount,
          unitPrice: item.unitPrice,
          carId: item.carId,
          configuration: item.configuration
            ? {
                create: {
                  complectation: item.configuration.complectation,
                  materialId: item.configuration.materialId,
                  color: item.configuration.color,
                  pattern: item.configuration.pattern,
                  threadColor: item.configuration.threadColor,
                  edgingColor: item.configuration.edgingColor,
                  removableMatType: item.configuration.removableMatType,
                  removableMatColor: item.configuration.removableMatColor,
                  removableMatThreadColor: item.configuration.removableMatThreadColor,
                  removableMatEdging: item.configuration.removableMatEdging,
                  heelPad: item.configuration.heelPad,
                  pockets: item.configuration.pockets,
                  pocketsPairs: item.configuration.pocketsPairs,
                  pocketsLogo: item.configuration.pocketsLogo,
                  logo: item.configuration.logo,
                  customLogoText: item.configuration.customLogoText,
                  embroidery: item.configuration.embroidery,
                  extraAccessories: item.configuration.extraAccessories,
                },
              }
            : undefined,
        })),
      },
      statusHistory: { create: { toStatus: "DRAFT", changedById: user.employee.id } },
    },
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "DUPLICATE", entityType: "Order", entityId: newOrder.id, newValue: { sourceOrderId: orderId } },
  });

  return newOrder;
}

/** §21 More — ROP/Director бар скидканы тікелей өзгертеді (жаңа approval сұрамай). */
export async function changeOrderDiscount(user: ActingUser, orderId: string, newDiscountAmount: number) {
  assertPermission(user, "orders", PermissionAction.APPROVE);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const finalAmount = Number(order.totalAmount) - newDiscountAmount;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { discountAmount: newDiscountAmount, finalAmount },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "CHANGE_DISCOUNT",
      entityType: "Order",
      entityId: orderId,
      oldValue: { discountAmount: order.discountAmount },
      newValue: { discountAmount: newDiscountAmount },
    },
  });
  return updated;
}

/** §27 — ROP менеджерді ауыстырады, тарихы сақталады (auditLog арқылы). */
export async function changeOrderManager(user: ActingUser, orderId: string, newManagerId: string) {
  assertPermission(user, "orders", PermissionAction.APPROVE);
  const order = await prisma.order.update({ where: { id: orderId }, data: { salesManagerId: newManagerId } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "REASSIGN", entityType: "Order", entityId: orderId, newValue: { salesManagerId: newManagerId } },
  });
  return order;
}

// §23 — @tag → department slug/role name. Мысалдар спецификациядан: "@Цех", "@Installer".
const MENTION_ALIASES: Record<string, { departmentSlug?: string; roleName?: string }> = {
  "цех": { departmentSlug: "production" },
  "production": { departmentSlug: "production" },
  "installer": { roleName: "INSTALLER" },
  "орнатушы": { roleName: "INSTALLER" },
  "delivery": { departmentSlug: "logistics" },
  "доставка": { departmentSlug: "logistics" },
  "склад": { departmentSlug: "warehouse" },
  "warehouse": { departmentSlug: "warehouse" },
  "finance": { departmentSlug: "finance" },
  "қаржы": { departmentSlug: "finance" },
  "rop": { roleName: "DEPARTMENT_HEAD" },
  "sales": { departmentSlug: "sales" },
};

async function notifyMentions(orderId: string, body: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
  const tags = [...body.matchAll(/@(\S+)/g)].map((m) => m[1].toLowerCase());
  for (const tag of tags) {
    const alias = MENTION_ALIASES[tag];
    let recipientIds: string[] = [];
    let departmentId: string | undefined;
    if (alias?.departmentSlug) {
      const dept = await prisma.department.findUnique({ where: { slug: alias.departmentSlug } });
      departmentId = dept?.id;
    } else if (alias?.roleName) {
      const employees = await prisma.employee.findMany({
        where: { user: { userRoles: { some: { role: { name: alias.roleName } } } } },
        include: { user: true },
      });
      recipientIds = employees.map((e) => e.user.id);
    } else {
      // Тікелей қызметкер атымен белгіленсе (мыс. @Амина)
      const employee = await prisma.employee.findFirst({ where: { fullName: { contains: tag, mode: "insensitive" } }, include: { user: true } });
      if (employee) recipientIds = [employee.user.id];
    }

    if (departmentId) {
      await prisma.notification.create({
        data: { departmentId, level: "INFO", type: "order_mention", title: `Сізді белгіледі: ${order?.orderNumber}`, body },
      });
    }
    for (const recipientId of recipientIds) {
      await prisma.notification.create({
        data: { recipientId, level: "INFO", type: "order_mention", title: `Сізді белгіледі: ${order?.orderNumber}`, body },
      });
    }
  }
}

export async function addOrderComment(user: ActingUser, orderId: string, body: string) {
  assertPermission(user, "orders", PermissionAction.VIEW);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы пікір қалдыра алады");
  const comment = await prisma.orderComment.create({ data: { orderId, authorId: user.employee.id, body } });
  await notifyMentions(orderId, body);
  return comment;
}

/** §22 — толық audit trail (Order-мен байланысты барлық жазба). */
export async function getOrderAuditLog(user: ActingUser, orderId: string) {
  assertPermission(user, "orders", PermissionAction.VIEW);
  return prisma.auditLog.findMany({
    where: { entityId: orderId },
    include: { actor: { include: { employee: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** §24 — Files/Photos. URL негізді (сыртқы storage/upload инфрасы кейінгі фазада). */
export async function addOrderAttachment(user: ActingUser, orderId: string, type: string, url: string) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  if (!user.employee) throw new Error("Тек қызметкер профилі бар пайдаланушы файл қоса алады");
  return prisma.orderAttachment.create({
    data: { orderId, type: type as never, url, uploadedById: user.employee.id },
  });
}

/** §29 Sales Manager тізімі — Change Manager select-і үшін. */
/** §2 — Client карточкасында көрсету үшін: барлық заказы, жалпы сомасы, соңғы сатып алу күні. */
export async function getClientSummary(customerId: string) {
  const orders = await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, orderNumber: true, finalAmount: true, status: true, createdAt: true },
  });
  const totalSpent = orders.reduce((sum, o) => sum + Number(o.finalAmount), 0);
  const avgCheck = orders.length > 0 ? totalSpent / orders.length : 0;
  return {
    ordersCount: orders.length,
    totalSpent,
    avgCheck,
    lastOrderAt: orders[0]?.createdAt ?? null,
    recentOrders: orders.slice(0, 5),
  };
}

export async function listSalesManagers() {
  return prisma.employee.findMany({
    where: { user: { userRoles: { some: { role: { name: { in: ["SALES_MANAGER", "SENIOR_SALES_MANAGER"] } } } } } },
    orderBy: { fullName: "asc" },
  });
}

/** §39 — cron жоқ болғандықтан, уақытқа тәуелді ескертулер (Production Delayed,
 *  Installation/Delivery Today, Client Debt) осы функция арқылы тексеріледі. Idempotent:
 *  әр тексеріс күніне/заказға бір рет қана Notification жазады (payload.orderId + type
 *  бойынша бүгінгі жазба бар-жоғы тексеріледі). /orders тізім бетінің әр жүктелуінде
 *  шақырылады — нақты cron орнына page-load-triggered idempotent check. */
export async function runScheduledOrderChecks(): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  async function alreadyNotifiedToday(type: string, orderId: string): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
      where: {
        type,
        createdAt: { gte: todayStart },
        payload: { path: ["orderId"], equals: orderId },
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  const [productionDept, logisticsDept, financeDept] = await Promise.all([
    prisma.department.findUnique({ where: { slug: "production" } }),
    prisma.department.findUnique({ where: { slug: "logistics" } }),
    prisma.department.findUnique({ where: { slug: "finance" } }),
  ]);

  // Production Delayed — deadline өтіп кетті, бірақ заказ әлі өндірісте/күтуде.
  const delayedOrders = await prisma.order.findMany({
    where: {
      status: { in: ["WAITING_PRODUCTION", "IN_PRODUCTION"] },
      deadline: { lt: now },
    },
    select: { id: true, orderNumber: true, deadline: true, salesManager: { include: { user: true } } },
  });
  for (const order of delayedOrders) {
    if (await alreadyNotifiedToday("order_production_delayed", order.id)) continue;
    await prisma.notification.create({
      data: {
        departmentId: productionDept?.id,
        level: "CRITICAL",
        type: "order_production_delayed",
        title: `Мерзімі өтті: ${order.orderNumber}`,
        body: `Дедлайн ${order.deadline?.toLocaleDateString("ru-RU")} өтіп кетті, заказ әлі өндірісте.`,
        payload: { orderId: order.id },
      },
    });
    if (order.salesManager?.user) {
      await prisma.notification.create({
        data: {
          recipientId: order.salesManager.user.id,
          level: "WARNING",
          type: "order_production_delayed",
          title: `Мерзімі өтті: ${order.orderNumber}`,
          body: "Өндіріс мерзімі кешігуде — клиентке хабарласу қажет болуы мүмкін.",
          payload: { orderId: order.id },
        },
      });
    }
  }

  // Installation Today
  const installationsToday = await prisma.installation.findMany({
    where: {
      date: { gte: todayStart, lt: todayEnd },
      status: { in: ["SCHEDULED", "WAITING"] },
    },
    include: { order: true, installer: { include: { user: true } } },
  });
  for (const inst of installationsToday) {
    if (await alreadyNotifiedToday("order_installation_today", inst.orderId)) continue;
    await prisma.notification.create({
      data: {
        recipientId: inst.installer?.user.id,
        departmentId: inst.installer ? undefined : logisticsDept?.id,
        level: "INFO",
        type: "order_installation_today",
        title: `Бүгін орнату: ${inst.order.orderNumber}`,
        body: inst.date ? `Уақыты: ${inst.date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : undefined,
        payload: { orderId: inst.orderId },
      },
    });
  }

  // Delivery Today
  const deliveriesToday = await prisma.delivery.findMany({
    where: {
      deliveryDate: { gte: todayStart, lt: todayEnd },
      status: { in: ["NEW", "PLANNED"] },
    },
    include: { order: true, courier: { include: { user: true } } },
  });
  for (const del of deliveriesToday) {
    if (await alreadyNotifiedToday("order_delivery_today", del.orderId)) continue;
    await prisma.notification.create({
      data: {
        recipientId: del.courier?.user.id,
        departmentId: del.courier ? undefined : logisticsDept?.id,
        level: "INFO",
        type: "order_delivery_today",
        title: `Бүгін доставка: ${del.order.orderNumber}`,
        body: [del.city, del.address].filter(Boolean).join(", ") || undefined,
        payload: { orderId: del.orderId },
      },
    });
  }

  // Client Debt — заказ COMPLETED, бірақ толық төленбеген.
  const unpaidCompleted = await prisma.order.findMany({
    where: { status: "COMPLETED" },
    select: { id: true, orderNumber: true, finalAmount: true, paidAmount: true, salesManager: { include: { user: true } } },
  });
  for (const order of unpaidCompleted) {
    const debt = Number(order.finalAmount) - Number(order.paidAmount);
    if (debt <= 0) continue;
    if (await alreadyNotifiedToday("order_client_debt", order.id)) continue;
    await prisma.notification.create({
      data: {
        departmentId: financeDept?.id,
        level: "WARNING",
        type: "order_client_debt",
        title: `Борыш бар: ${order.orderNumber}`,
        body: `Қалған сома: ${new Intl.NumberFormat("ru-RU").format(debt)} ₸`,
        payload: { orderId: order.id },
      },
    });
    if (order.salesManager?.user) {
      await prisma.notification.create({
        data: {
          recipientId: order.salesManager.user.id,
          level: "WARNING",
          type: "order_client_debt",
          title: `Борыш бар: ${order.orderNumber}`,
          body: `Қалған сома: ${new Intl.NumberFormat("ru-RU").format(debt)} ₸`,
          payload: { orderId: order.id },
        },
      });
    }
  }
}

// §49 — ескі заказдардың кез келген жерін (клиент/көлік/заказ деректері/тауар
// конфигурациясы) өзгерту мүмкіндігі. Клиент пен көлік жазбалары Customer/
// CustomerCar кестесінде сақталады (басқа заказдармен ортақ болуы мүмкін) —
// осы жерде өзгерту сол клиенттің/көліктің БАРЛЫҚ заказдарына әсер етеді, бұл
// күтілетін мінез-құлық (нақты клиент деректерін түзету, тек осы заказға ғана
// емес).

export interface UpdateOrderCustomerInput {
  fullName?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  clientType?: "INDIVIDUAL" | "COMPANY";
  isVip?: boolean;
}

export async function updateOrderCustomer(user: ActingUser, orderId: string, input: UpdateOrderCustomerInput) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true } });
  const updated = await prisma.customer.update({
    where: { id: order.customerId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp || null } : {}),
      ...(input.city !== undefined ? { city: input.city || null } : {}),
      ...(input.clientType !== undefined ? { clientType: input.clientType as never } : {}),
      ...(input.isVip !== undefined ? { isVip: input.isVip } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "EDIT_CUSTOMER",
      entityType: "Order",
      entityId: orderId,
      oldValue: { fullName: order.customer.fullName, phone: order.customer.phone },
      newValue: { fullName: updated.fullName, phone: updated.phone },
    },
  });
  return updated;
}

export interface UpdateOrderVehicleInput {
  make?: string;
  model?: string;
  generation?: string;
  body?: string;
  year?: number;
  numberOfRows?: number;
  steeringSide?: "LEFT" | "RIGHT";
  vin?: string;
}

export async function updateOrderVehicle(user: ActingUser, orderId: string, input: UpdateOrderVehicleInput) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.vehicleId) throw new Error("Бұл заказда көлік таңдалмаған");
  const before = await prisma.customerCar.findUniqueOrThrow({ where: { id: order.vehicleId } });
  const updated = await prisma.customerCar.update({
    where: { id: order.vehicleId },
    data: {
      ...(input.make !== undefined ? { make: input.make } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.generation !== undefined ? { generation: input.generation || null } : {}),
      ...(input.body !== undefined ? { body: input.body || null } : {}),
      ...(input.year !== undefined ? { year: input.year || null } : {}),
      ...(input.numberOfRows !== undefined ? { numberOfRows: input.numberOfRows || null } : {}),
      ...(input.steeringSide !== undefined ? { steeringSide: (input.steeringSide || null) as never } : {}),
      ...(input.vin !== undefined ? { vin: input.vin || null } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "EDIT_VEHICLE",
      entityType: "Order",
      entityId: orderId,
      oldValue: { make: before.make, model: before.model },
      newValue: { make: updated.make, model: updated.model },
    },
  });
  return updated;
}

export interface UpdateOrderDetailsInput {
  priority?: string;
  source?: string;
  salesChannel?: string;
  certificateNo?: string;
  managerBonus?: number;
  comment?: string;
  deadline?: string;
  fulfillmentType?: "INSTALLATION" | "DELIVERY" | "PICKUP";
}

export async function updateOrderDetails(user: ActingUser, orderId: string, input: UpdateOrderDetailsInput) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...(input.priority !== undefined ? { priority: input.priority as never } : {}),
      ...(input.source !== undefined ? { source: input.source || null } : {}),
      ...(input.salesChannel !== undefined ? { salesChannel: input.salesChannel || null } : {}),
      ...(input.certificateNo !== undefined ? { certificateNo: input.certificateNo || null } : {}),
      ...(input.managerBonus !== undefined ? { managerBonus: input.managerBonus } : {}),
      ...(input.comment !== undefined ? { comment: input.comment || null } : {}),
      ...(input.deadline !== undefined ? { deadline: input.deadline ? new Date(input.deadline) : null } : {}),
      ...(input.fulfillmentType !== undefined ? { fulfillmentType: (input.fulfillmentType || null) as never } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "EDIT_DETAILS",
      entityType: "Order",
      entityId: orderId,
      oldValue: { priority: order.priority, comment: order.comment },
      newValue: { priority: updated.priority, comment: updated.comment },
    },
  });
  return updated;
}

export interface UpdateOrderItemInput {
  productId?: string;
  qty?: number;
  configuration?: {
    complectation?: string;
    materialId?: string;
    color?: string;
    pattern?: string;
    threadColor?: string;
    edgingColor?: string;
    removableMatType?: string;
    removableMatColor?: string;
    removableMatThreadColor?: string;
    removableMatEdging?: string;
    heelPad?: boolean;
    pockets?: boolean;
    pocketsPairs?: number;
    pocketsLogo?: boolean;
    logo?: boolean;
    customLogoText?: string;
    embroidery?: boolean;
    extraAccessories?: string;
  };
}

/** Тауар/саны өзгертілсе, заказдың жалпы сомасы қайта есептеледі. Скидка сомасы
 *  (order.discountAmount) өзгертілмейді — ол бекітілген, жеке келісілген сома
 *  (мөлшері "Скидканы өзгерту" арқылы ғана өзгереді), санды өзгерту оны
 *  автоматты пропорционалды өзгертпейді. */
export async function updateOrderItem(user: ActingUser, orderId: string, itemId: string, input: UpdateOrderItemInput) {
  assertPermission(user, "orders", PermissionAction.EDIT);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new Error("Тауар жолы табылмады");

  let product = null;
  if (input.productId && input.productId !== item.productId) {
    product = await prisma.product.findUniqueOrThrow({ where: { id: input.productId } });
  }
  const basePrice = product ? Number(product.basePrice) : Number(item.basePrice);
  const qty = input.qty ?? item.qty;
  const unitPrice = basePrice - Number(item.discountAmount);

  await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      ...(product
        ? { productId: product.id, productCategory: product.category, productType: product.type, productClass: product.class, basePrice }
        : {}),
      qty,
      unitPrice,
      ...(input.configuration
        ? {
            configuration: {
              upsert: {
                create: input.configuration,
                update: input.configuration,
              },
            },
          }
        : {}),
    },
  });

  // Жалпы сома — барлық тауар жолдарының (жаңартылған мәндермен) қосындысы.
  const freshItems = await prisma.orderItem.findMany({ where: { orderId } });
  const totalAmount = freshItems.reduce((s, i) => s + Number(i.basePrice) * i.qty, 0);
  const finalAmount = totalAmount - Number(order.discountAmount);
  const updated = await prisma.order.update({ where: { id: orderId }, data: { totalAmount, finalAmount } });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "EDIT_ITEM",
      entityType: "Order",
      entityId: orderId,
      oldValue: { itemId, qty: item.qty, productId: item.productId },
      newValue: { itemId, qty, productId: product?.id ?? item.productId },
    },
  });

  return updated;
}
