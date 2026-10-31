import Link from "next/link";
import { PermissionAction } from "@/lib/db";
import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { can, ForbiddenError } from "@/lib/rbac";
import {
  getOrderDetail,
  paymentStatus,
  listSalesManagers,
  getClientSummary,
  getOrderAuditLog,
  getOrderInsights,
  listProducts,
  listMaterials,
} from "@/lib/domain/orders";
import { PrintButton } from "./PrintButton";
import { OrderTimeline } from "./OrderTimeline";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import {
  orderStatusLabel,
  ORDER_STATUS_TONE,
  paymentStatusLabel,
  PAYMENT_STATUS_TONE,
  paymentMethodLabel,
  formatTenge,
} from "@/lib/order-labels";
import {
  addPaymentAction,
  confirmOrderAction,
  sendToProductionAction,
  markOrderReadyAction,
  advanceAfterReadyAction,
  completeOrderAction,
  cancelOrderAction,
  requestOrderDiscountAction,
  approveOrderDiscountAction,
  rejectOrderDiscountAction,
  changeOrderManagerAction,
  addOrderCommentAction,
  addOrderAttachmentAction,
  recordQualityCheckAction,
  updateInstallationStatusAction,
  updateDeliveryStatusAction,
  returnOrderAction,
  reworkOrderAction,
  duplicateOrderAction,
  changeOrderDiscountAction,
  updateOrderCustomerAction,
  updateOrderVehicleAction,
  updateOrderDetailsAction,
  updateOrderItemAction,
} from "../actions";

type TabKey = "overview" | "client" | "vehicle" | "products" | "payments" | "production" | "fulfillment" | "files" | "history";
const TAB_KEYS: TabKey[] = ["overview", "client", "vehicle", "products", "payments", "production", "fulfillment", "files", "history"];

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  const { error, tab: tabParam } = await searchParams;
  const tab: TabKey = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "overview";
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const statusLabel = orderStatusLabel(locale);
  const payStatusLabel = paymentStatusLabel(locale);
  const methodLabel = paymentMethodLabel(locale);

  // §36 — Order Card tabs
  const TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: t("Жалпы шолу", "Обзор") },
    { key: "client", label: t("Клиент", "Клиент") },
    { key: "vehicle", label: t("Көлік", "Автомобиль") },
    { key: "products", label: t("Тауарлар", "Товары") },
    { key: "payments", label: t("Төлемдер", "Платежи") },
    { key: "production", label: t("Өндіріс", "Производство") },
    { key: "fulfillment", label: t("Орнату / Жеткізу", "Установка / Доставка") },
    { key: "files", label: t("Файлдар", "Файлы") },
    { key: "history", label: t("Тарих", "История") },
  ];

  try {
    const order = await getOrderDetail(user, id);
    const ps = paymentStatus(order);
    const canApprove = can(user, "orders", PermissionAction.APPROVE);
    const managers = canApprove ? await listSalesManagers() : [];
    const clientSummary = await getClientSummary(order.customerId);
    const isOverdue = order.deadline && order.deadline < new Date() && !["COMPLETED", "CANCELLED"].includes(order.status);
    const auditLog = tab === "history" ? await getOrderAuditLog(user, order.id) : [];
    const insights = tab === "overview" ? await getOrderInsights(order) : [];
    const [productsList, materialsList] =
      tab === "products" ? await Promise.all([listProducts(), listMaterials()]) : [[], []];
    const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { dateStyle: "medium", timeStyle: "short" });

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{order.orderNumber}</h1>
            <p className="text-sm text-text-secondary">{dateFmt.format(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>{statusLabel[order.status]}</StatusBadge>
            <StatusBadge tone={PAYMENT_STATUS_TONE[ps]}>{payStatusLabel[ps]}</StatusBadge>
          </div>
        </div>

        {error && (
          <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {/* ACTIONS — барлық tab-та бірдей көрінеді, себебі негізгі басқару элементі */}
        <Card title={t("Әрекеттер", "Действия")}>
          <div className="flex flex-wrap gap-2">
            {order.status === "NEW" && (
              <ActionForm action={confirmOrderAction} orderId={order.id} label={t("Заказды растау", "Подтвердить заказ")} primary />
            )}
            {["CONFIRMED", "WAITING_PAYMENT"].includes(order.status) && (
              <ActionForm action={sendToProductionAction} orderId={order.id} label={t("Өндіріске жіберу", "Отправить в производство")} primary />
            )}
            {order.status === "IN_PRODUCTION" && (
              <ActionForm action={markOrderReadyAction} orderId={order.id} label={t("Дайын деп белгілеу", "Отметить готовым")} primary />
            )}
            {order.status === "READY" && (
              <ActionForm
                action={advanceAfterReadyAction}
                orderId={order.id}
                label={
                  order.fulfillmentType === "INSTALLATION"
                    ? t("Орнатуға жіберу", "Отправить на установку")
                    : order.fulfillmentType === "DELIVERY"
                      ? t("Доставкаға жіберу", "Отправить на доставку")
                      : t("Заказды аяқтау", "Завершить заказ")
                }
                primary
              />
            )}
            {["WAITING_INSTALLATION", "WAITING_DELIVERY", "IN_DELIVERY"].includes(order.status) && (
              <ActionForm action={completeOrderAction} orderId={order.id} label={t("Заказды аяқтау", "Завершить заказ")} primary />
            )}
            {!["COMPLETED", "CANCELLED"].includes(order.status) && (
              <ActionForm action={cancelOrderAction} orderId={order.id} label={t("Болдырмау", "Отменить")} />
            )}
          </div>
        </Card>

        {/* §21 — MORE */}
        <Card title={t("Қосымша әрекеттер", "Дополнительные действия")}>
          <div className="flex flex-wrap items-center gap-2">
            {order.status === "COMPLETED" && (
              <ActionForm action={returnOrderAction} orderId={order.id} label={t("Қайтару", "Возврат")} small />
            )}
            {!["DRAFT", "CANCELLED"].includes(order.status) && (
              <ActionForm action={reworkOrderAction} orderId={order.id} label={t("Қайта жасау", "Переделать")} small />
            )}
            <ActionForm action={duplicateOrderAction} orderId={order.id} label={t("Заказды көшіру", "Дублировать заказ")} small />
            <PrintButton label={t("Басып шығару", "Печать")} />
            {canApprove && (
              <form action={changeOrderDiscountAction} className="flex items-center gap-1.5">
                <input type="hidden" name="orderId" value={order.id} />
                <span className="text-xs text-text-secondary">{t("Скидка сомасы:", "Сумма скидки:")}</span>
                <input
                  type="number"
                  name="discountAmount"
                  defaultValue={order.discountAmount.toString()}
                  className="w-28 rounded-icon border border-border bg-page-bg px-2 py-1.5 text-xs"
                />
                <SmallButton>{t("Скидканы өзгерту", "Изменить скидку")}</SmallButton>
              </form>
            )}
          </div>
        </Card>

        {/* §36 — TAB NAV */}
        <div className="flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((tabItem) => (
            <Link
              key={tabItem.key}
              href={`/orders/${order.id}?tab=${tabItem.key}`}
              className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === tabItem.key
                  ? "border-b-2 border-accent text-accent"
                  : "border-b-2 border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {tabItem.label}
            </Link>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="flex flex-col gap-4">
            <Card title={t("Хроника", "Хроника")}>
              <OrderTimeline statusHistory={order.statusHistory} fulfillmentType={order.fulfillmentType} dateFmt={dateFmt} locale={locale} />
            </Card>
            {insights.length > 0 && (
              <Card title={t("AI көмекші (ережелер негізінде)", "AI-помощник (на основе правил)")}>
                <p className="mb-2 text-xs text-text-secondary">
                  {t(
                    "Нағыз AI (Claude API) үшін ANTHROPIC_API_KEY қажет — қазір ережелерге негізделген кеңес көрсетіледі.",
                    "Для настоящего AI (Claude API) нужен ANTHROPIC_API_KEY — сейчас показаны советы на основе правил."
                  )}
                </p>
                <div className="flex flex-col gap-2">
                  {insights.map((insight, i) => (
                    <div
                      key={i}
                      className={`rounded-icon border px-3 py-2 text-sm ${
                        insight.level === "critical"
                          ? "border-danger/30 bg-danger/10 text-danger"
                          : insight.level === "warning"
                            ? "border-status-shipping/30 bg-status-shipping/10 text-status-shipping"
                            : "border-border bg-page-bg text-text-primary"
                      }`}
                    >
                      <p className="font-semibold">{insight.title}</p>
                      <p className="text-xs opacity-90">{insight.body}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card title={t("Клиент", "Клиент")}>
                <InfoRow label={t("Аты-жөні", "ФИО")} value={order.customer.fullName} />
                <InfoRow label={t("Телефон", "Телефон")} value={order.customer.phone} />
                <InfoRow label={t("Көлік", "Автомобиль")} value={order.vehicle ? `${order.vehicle.make} ${order.vehicle.model}` : "—"} />
              </Card>
              <Card title={t("Тауарлар", "Товары")}>
                <InfoRow label={t("Тауарлар", "Товары")} value={order.items.map((i) => i.product.name).join(", ") || "—"} />
                <InfoRow label={t("Менеджер", "Менеджер")} value={order.salesManager.fullName} />
              </Card>
              <Card title={t("Сома", "Сумма")}>
                <InfoRow label={t("Заказ сомасы", "Сумма заказа")} value={formatTenge(order.finalAmount)} bold />
                <InfoRow label={t("Төленген", "Оплачено")} value={formatTenge(order.paidAmount)} />
                <InfoRow label={t("Қалды", "Осталось")} value={formatTenge(Number(order.finalAmount) - Number(order.paidAmount))} />
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-text-secondary">{t("Мерзімі", "Срок")}</span>
                  <span className={isOverdue ? "font-bold text-danger" : "text-text-primary"}>
                    {order.deadline ? dateFmt.format(order.deadline) : "—"} {isOverdue && `· ${t("МЕРЗІМІ ӨТТІ", "СРОК ПРОШЁЛ")}`}
                  </span>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* CLIENT */}
        {tab === "client" && (
          <div className="flex flex-col gap-4">
            <Card title={t("Клиент", "Клиент")}>
              <form action={updateOrderCustomerAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="orderId" value={order.id} />
                <Field label={t("Аты-жөні", "ФИО")}>
                  <input name="fullName" defaultValue={order.customer.fullName} className={editInputClass} />
                </Field>
                <Field label={t("Телефон", "Телефон")}>
                  <input name="phone" defaultValue={order.customer.phone} className={editInputClass} />
                </Field>
                <Field label="WhatsApp">
                  <input name="whatsapp" defaultValue={order.customer.whatsapp ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Қала", "Город")}>
                  <input name="city" defaultValue={order.customer.city ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Түрі", "Тип")}>
                  <select name="clientType" defaultValue={order.customer.clientType} className={editInputClass}>
                    <option value="INDIVIDUAL">{t("Жеке тұлға", "Физ. лицо")}</option>
                    <option value="COMPANY">{t("Компания", "Компания")}</option>
                  </select>
                </Field>
                <Field label="VIP">
                  <select name="isVip" defaultValue={order.customer.isVip ? "yes" : "no"} className={editInputClass}>
                    <option value="no">{t("Жоқ", "Нет")}</option>
                    <option value="yes">{t("Иә", "Да")}</option>
                  </select>
                </Field>
                <div className="col-span-full">
                  <button type="submit" className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                    {t("Сақтау", "Сохранить")}
                  </button>
                </div>
              </form>
              <div className="mt-3 border-t border-border pt-3">
                <InfoRow label={t("Барлық заказы", "Всего заказов")} value={String(clientSummary.ordersCount)} />
                <InfoRow label={t("Жалпы сомасы", "Общая сумма")} value={formatTenge(clientSummary.totalSpent)} />
                <InfoRow label={t("Орташа чек", "Средний чек")} value={formatTenge(clientSummary.avgCheck)} />
                <InfoRow label={t("Соңғы сатып алу", "Последняя покупка")} value={clientSummary.lastOrderAt ? dateFmt.format(clientSummary.lastOrderAt) : "—"} />
              </div>
              {canApprove && (
                <form action={changeOrderManagerAction} className="mt-3 flex items-end gap-2 border-t border-border pt-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <Field label={t("Менеджерді ауыстыру (ROP)", "Сменить менеджера (РОП)")}>
                    <select name="managerId" defaultValue={order.salesManagerId} className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary">
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <SmallButton>{t("Ауыстыру", "Сменить")}</SmallButton>
                </form>
              )}
            </Card>

            <Card title={t("Заказ мәліметтері", "Данные заказа")}>
              <form action={updateOrderDetailsAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="orderId" value={order.id} />
                <Field label={t("Дереккөз (канал обращения)", "Источник (канал обращения)")}>
                  <input name="source" defaultValue={order.source ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Канал продаж", "Канал продаж")}>
                  <input name="salesChannel" defaultValue={order.salesChannel ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Сертификат нөмірі", "Номер сертификата")}>
                  <input name="certificateNo" defaultValue={order.certificateNo ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Менеджер бонусы", "Бонус менеджера")}>
                  <input name="managerBonus" type="number" min={0} defaultValue={order.managerBonus?.toString() ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Приоритет", "Приоритет")}>
                  <select name="priority" defaultValue={order.priority} className={editInputClass}>
                    <option value="LOW">{t("Төмен", "Низкий")}</option>
                    <option value="NORMAL">{t("Қалыпты", "Обычный")}</option>
                    <option value="HIGH">{t("Жоғары", "Высокий")}</option>
                    <option value="URGENT">{t("Шұғыл", "Срочный")}</option>
                  </select>
                </Field>
                <Field label={t("Дедлайн", "Дедлайн")}>
                  <input
                    name="deadline"
                    type="date"
                    defaultValue={order.deadline ? order.deadline.toISOString().slice(0, 10) : ""}
                    className={editInputClass}
                  />
                </Field>
                <Field label={t("Жеткізу түрі", "Тип доставки")}>
                  <select name="fulfillmentType" defaultValue={order.fulfillmentType ?? ""} className={editInputClass}>
                    <option value="">—</option>
                    <option value="INSTALLATION">{t("Орнату", "Установка")}</option>
                    <option value="DELIVERY">{t("Доставка", "Доставка")}</option>
                    <option value="PICKUP">{t("Өзі алып кету", "Самовывоз")}</option>
                  </select>
                </Field>
                <Field label={t("Комментарий", "Комментарий")}>
                  <input name="comment" defaultValue={order.comment ?? ""} className={editInputClass} />
                </Field>
                <div className="col-span-full">
                  <button type="submit" className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                    {t("Сақтау", "Сохранить")}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* VEHICLE */}
        {tab === "vehicle" && (
          <Card title={t("Көлік", "Автомобиль")}>
            {order.vehicle ? (
              <form action={updateOrderVehicleAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="orderId" value={order.id} />
                <Field label={t("Марка", "Марка")}>
                  <input name="make" defaultValue={order.vehicle.make} className={editInputClass} />
                </Field>
                <Field label={t("Модель", "Модель")}>
                  <input name="model" defaultValue={order.vehicle.model} className={editInputClass} />
                </Field>
                <Field label={t("Буын (generation)", "Поколение")}>
                  <input name="generation" defaultValue={order.vehicle.generation ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Кузов", "Кузов")}>
                  <input name="body" defaultValue={order.vehicle.body ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Шығарылған жылы", "Год выпуска")}>
                  <input name="year" type="number" defaultValue={order.vehicle.year?.toString() ?? ""} className={editInputClass} />
                </Field>
                <Field label={t("Қатар саны", "Количество рядов")}>
                  <input
                    name="numberOfRows"
                    type="number"
                    min={1}
                    max={3}
                    defaultValue={order.vehicle.numberOfRows?.toString() ?? ""}
                    className={editInputClass}
                  />
                </Field>
                <Field label={t("Руль жағы", "Сторона руля")}>
                  <select name="steeringSide" defaultValue={order.vehicle.steeringSide ?? ""} className={editInputClass}>
                    <option value="">—</option>
                    <option value="LEFT">{t("Сол жақ", "Левый")}</option>
                    <option value="RIGHT">{t("Оң жақ", "Правый")}</option>
                  </select>
                </Field>
                <Field label="VIN">
                  <input name="vin" defaultValue={order.vehicle.vin ?? ""} className={editInputClass} />
                </Field>
                <div className="col-span-full">
                  <button type="submit" className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                    {t("Сақтау", "Сохранить")}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-text-secondary">{t("Көлік таңдалмаған", "Автомобиль не выбран")}</p>
            )}
          </Card>
        )}

        {/* PRODUCTS */}
        {tab === "products" && (
          <div className="flex flex-col gap-4">
            <Card title={t("Тауарлар", "Товары")}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-text-secondary">
                      <th className="pb-2 pr-4 font-semibold">{t("Тауар", "Товар")}</th>
                      <th className="pb-2 pr-4 font-semibold">{t("Саны", "Кол-во")}</th>
                      <th className="pb-2 pr-4 font-semibold">{t("Баға", "Цена")}</th>
                      <th className="pb-2 pr-4 font-semibold">{t("Скидка", "Скидка")}</th>
                      <th className="pb-2 pr-4 font-semibold">{t("Конфигурация", "Конфигурация")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-t border-border align-top">
                        <td className="py-2 pr-4 text-text-primary">{item.product.name}</td>
                        <td className="py-2 pr-4 tabular-nums text-text-secondary">{item.qty}</td>
                        <td className="py-2 pr-4 font-semibold tabular-nums text-text-primary">{formatTenge(item.unitPrice)}</td>
                        <td className="py-2 pr-4 tabular-nums text-text-secondary">{formatTenge(item.discountAmount)}</td>
                        <td className="py-2 pr-4 text-xs text-text-secondary">
                          {item.configuration
                            ? [
                                item.configuration.complectation,
                                item.configuration.color,
                                item.configuration.material?.name,
                                item.configuration.threadColor && `${t("жіп", "нить")}: ${item.configuration.threadColor}`,
                                item.configuration.removableMatType,
                                item.configuration.removableMatThreadColor &&
                                  `${t("полик жібі", "нить коврика")}: ${item.configuration.removableMatThreadColor}`,
                                item.configuration.pocketsPairs != null &&
                                  `${t("кармашки", "карманы")}: ${item.configuration.pocketsPairs}`,
                                item.configuration.pocketsLogo && t("кармашки лого бар", "лого на карманах"),
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title={t("Тауарларды өзгерту", "Редактировать товары")}>
              <div className="flex flex-col gap-3">
                {order.items.map((item) => (
                  <details key={item.id} className="rounded-icon border border-border p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-accent">
                      {item.product.name} ▾
                    </summary>
                    <form action={updateOrderItemAction} className="mt-3 flex flex-col gap-3">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label={t("Тауар", "Товар")}>
                          <select name="productId" defaultValue={item.productId} className={editInputClass}>
                            {productsList.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — {formatTenge(p.basePrice)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("Саны", "Кол-во")}>
                          <input name="qty" type="number" min={1} defaultValue={item.qty} className={editInputClass} />
                        </Field>
                        <Field label={t("Комплектация", "Комплектация")}>
                          <input name="complectation" defaultValue={item.configuration?.complectation ?? ""} className={editInputClass} />
                        </Field>
                        <Field label={t("Материал (Кожа)", "Материал (кожа)")}>
                          <select name="materialId" defaultValue={item.configuration?.materialId ?? ""} className={editInputClass}>
                            <option value="">—</option>
                            {materialsList.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} · {m.color}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("Түсі", "Цвет")}>
                          <input name="color" defaultValue={item.configuration?.color ?? ""} className={editInputClass} />
                        </Field>
                        <Field label={t("Өрнек", "Узор")}>
                          <input name="pattern" defaultValue={item.configuration?.pattern ?? ""} className={editInputClass} />
                        </Field>
                        <Field label={t("Жіп түсі", "Цвет нити")}>
                          <input name="threadColor" defaultValue={item.configuration?.threadColor ?? ""} className={editInputClass} />
                        </Field>
                        <Field label={t("Кант түсі", "Цвет окантовки")}>
                          <input name="edgingColor" defaultValue={item.configuration?.edgingColor ?? ""} className={editInputClass} />
                        </Field>
                        <Field label={t("Сьемный полик түрі", "Тип съёмного коврика")}>
                          <input name="removableMatType" defaultValue={item.configuration?.removableMatType ?? ""} className={editInputClass} />
                        </Field>
                        <Field label={t("Полик түсі", "Цвет коврика")}>
                          <input name="removableMatColor" defaultValue={item.configuration?.removableMatColor ?? ""} className={editInputClass} />
                        </Field>
                        <Field label={t("Полик жіп түсі", "Нитка коврика")}>
                          <input
                            name="removableMatThreadColor"
                            defaultValue={item.configuration?.removableMatThreadColor ?? ""}
                            className={editInputClass}
                          />
                        </Field>
                        <Field label={t("Полик канты", "Окантовка коврика")}>
                          <input
                            name="removableMatEdging"
                            defaultValue={item.configuration?.removableMatEdging ?? ""}
                            className={editInputClass}
                          />
                        </Field>
                        <Field label={t("Подпятник", "Подпятник")}>
                          <EditYesNo name="heelPad" defaultValue={item.configuration?.heelPad} locale={locale} />
                        </Field>
                        <Field label={t("Кармашки", "Карманы")}>
                          <EditYesNo name="pockets" defaultValue={item.configuration?.pockets} locale={locale} />
                        </Field>
                        <Field label={t("Кармашки саны (пар)", "Карманы, сколько пар")}>
                          <input
                            name="pocketsPairs"
                            type="number"
                            min={0}
                            defaultValue={item.configuration?.pocketsPairs?.toString() ?? ""}
                            className={editInputClass}
                          />
                        </Field>
                        <Field label={t("Кармашки логосы", "Лого на карманах")}>
                          <EditYesNo name="pocketsLogo" defaultValue={item.configuration?.pocketsLogo} locale={locale} />
                        </Field>
                        <Field label={t("Лого", "Лого")}>
                          <EditYesNo name="logo" defaultValue={item.configuration?.logo} locale={locale} />
                        </Field>
                        <Field label={t("Custom лого мәтіні", "Текст лого")}>
                          <input name="customLogoText" defaultValue={item.configuration?.customLogoText ?? ""} className={editInputClass} />
                        </Field>
                        <Field label={t("Вышивка", "Вышивка")}>
                          <EditYesNo name="embroidery" defaultValue={item.configuration?.embroidery} locale={locale} />
                        </Field>
                        <Field label={t("Қосымша аксессуарлар", "Доп. аксессуары")}>
                          <input
                            name="extraAccessories"
                            defaultValue={item.configuration?.extraAccessories ?? ""}
                            className={editInputClass}
                          />
                        </Field>
                      </div>
                      <button
                        type="submit"
                        className="w-fit rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
                      >
                        {t("Сақтау", "Сохранить")}
                      </button>
                    </form>
                  </details>
                ))}
              </div>
            </Card>

            {order.discountRequests.length > 0 && (
              <Card title={t("Скидка сұраулары", "Запросы на скидку")}>
                <div className="flex flex-col divide-y divide-border">
                  {order.discountRequests.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <div className="text-sm text-text-primary">
                        {r.requestedBy.fullName} — {r.requestedPct.toString()}% {t("сұралды", "запрошено")} ·{" "}
                        <span className="text-text-secondary">{r.status}</span>
                        {r.approvedBy && <span className="text-text-secondary"> · {r.approvedBy.fullName}</span>}
                      </div>
                      {r.status === "PENDING" && canApprove && (
                        <div className="flex gap-1.5">
                          <ActionForm
                            action={approveOrderDiscountAction}
                            orderId={order.id}
                            extra={{ discountRequestId: r.id }}
                            label={t("Бекіту", "Одобрить")}
                            primary
                            small
                          />
                          <ActionForm
                            action={rejectOrderDiscountAction}
                            orderId={order.id}
                            extra={{ discountRequestId: r.id }}
                            label={t("Қабылдамау", "Отклонить")}
                            small
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {!order.discountRequests.some((r) => r.status === "PENDING") && (
              <Card title={t("Қосымша скидка сұрау", "Запросить дополнительную скидку")}>
                <form action={requestOrderDiscountAction} className="flex items-end gap-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input
                    type="number"
                    name="requestedPct"
                    min={1}
                    max={100}
                    step="0.1"
                    placeholder="%"
                    className="w-24 rounded-icon border border-border bg-page-bg px-3 py-2 text-sm"
                  />
                  <button type="submit" className="rounded-pill bg-page-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-border">
                    {t("Сұрау", "Запросить")}
                  </button>
                </form>
              </Card>
            )}
          </div>
        )}

        {/* PAYMENTS */}
        {tab === "payments" && (
          <Card title={t("Төлемдер", "Платежи")}>
            <form action={addPaymentAction} className="mb-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <Field label={t("Сома", "Сумма")}>
                <input type="number" name="amount" min={1} className="w-32 rounded-icon border border-border bg-page-bg px-3 py-2 text-sm" />
              </Field>
              <Field label={t("Әдіс", "Способ")}>
                <select name="method" className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm">
                  {Object.entries(methodLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Касса", "Касса")}>
                <input name="cashbox" className="w-28 rounded-icon border border-border bg-page-bg px-3 py-2 text-sm" />
              </Field>
              <button type="submit" className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                {t("+ Төлем қосу", "+ Добавить платёж")}
              </button>
            </form>
            {order.payments.length === 0 ? (
              <p className="text-sm text-text-secondary">{t("Төлем жоқ", "Платежей нет")}</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-2 pr-4 font-semibold">{t("Дата", "Дата")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Сома", "Сумма")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Әдіс", "Способ")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Қызметкер", "Сотрудник")}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-2 pr-4 text-text-secondary">{dateFmt.format(p.paidAt)}</td>
                      <td className="py-2 pr-4 font-semibold tabular-nums text-text-primary">{formatTenge(p.amount)}</td>
                      <td className="py-2 pr-4 text-text-secondary">{methodLabel[p.method]}</td>
                      <td className="py-2 pr-4 text-text-secondary">{p.employee?.fullName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {/* PRODUCTION */}
        {tab === "production" && (
          <Card title={t("Өндіріс", "Производство")}>
            {order.productionOrders.length === 0 ? (
              <p className="text-sm text-text-secondary">{t("Өндіріске жіберілмеген", "Не отправлен в производство")}</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {order.productionOrders.map((po) => (
                  <li key={po.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <span className="text-text-primary">{po.workshop ?? t("Цех тағайындалмаған", "Цех не назначен")}</span>{" "}
                      <span className="text-text-secondary">
                        · {po.status} {po.assignedWorker && `· ${po.assignedWorker.fullName}`}
                      </span>
                      {po.qualityChecks.length > 0 && (
                        <div className="text-xs text-text-secondary">
                          {t("Соңғы QC", "Последний QC")}: {po.qualityChecks[po.qualityChecks.length - 1].result}
                        </div>
                      )}
                    </div>
                    <form action={recordQualityCheckAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="productionOrderId" value={po.id} />
                      <select name="result" className="rounded-icon border border-border bg-page-bg px-2 py-1.5 text-xs">
                        <option value="PASSED">{t("QC: Өтті", "QC: Прошёл")}</option>
                        <option value="FAILED">{t("QC: Өтпеді", "QC: Не прошёл")}</option>
                        <option value="REWORK_REQUIRED">{t("QC: Қайта жасау", "QC: На переделку")}</option>
                      </select>
                      <SmallButton>{t("Жазу", "Записать")}</SmallButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* INSTALLATION / DELIVERY */}
        {tab === "fulfillment" && (
          <Card title={t("Орнату / Жеткізу", "Установка / Доставка")}>
            {!order.installation && !order.delivery && <p className="text-sm text-text-secondary">{t("Жоспарланбаған", "Не запланировано")}</p>}
            {order.installation && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-primary">
                <span>
                  {t("Орнату", "Установка")}: {order.installation.date ? dateFmt.format(order.installation.date) : "—"} ·{" "}
                  {order.installation.status} {order.installation.installer && `· ${order.installation.installer.fullName}`}
                </span>
                <form action={updateInstallationStatusAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="orderId" value={order.id} />
                  <select name="status" className="rounded-icon border border-border bg-page-bg px-2 py-1.5 text-xs">
                    <option value="WAITING">{t("Күтуде", "Ожидание")}</option>
                    <option value="IN_PROGRESS">{t("Орындалуда", "В процессе")}</option>
                    <option value="COMPLETED">{t("Аяқталды", "Завершено")}</option>
                    <option value="REWORK">{t("Қайта жасау", "Переделка")}</option>
                  </select>
                  <SmallButton>{t("Жаңарту", "Обновить")}</SmallButton>
                </form>
              </div>
            )}
            {order.delivery && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-text-primary">
                <span>
                  {t("Доставка", "Доставка")}: {order.delivery.address ?? "—"}, {order.delivery.city ?? ""} · {order.delivery.status}
                </span>
                <form action={updateDeliveryStatusAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="orderId" value={order.id} />
                  <select name="status" className="rounded-icon border border-border bg-page-bg px-2 py-1.5 text-xs">
                    <option value="PLANNED">{t("Жоспарланды", "Запланировано")}</option>
                    <option value="IN_DELIVERY">{t("Жолда", "В пути")}</option>
                    <option value="DELIVERED">{t("Жеткізілді", "Доставлено")}</option>
                    <option value="FAILED">{t("Сәтсіз", "Неудачно")}</option>
                  </select>
                  <SmallButton>{t("Жаңарту", "Обновить")}</SmallButton>
                </form>
              </div>
            )}
          </Card>
        )}

        {/* FILES */}
        {tab === "files" && (
          <Card title={t("Файлдар", "Файлы")}>
            <form action={addOrderAttachmentAction} className="mb-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <select name="type" className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm">
                <option value="PRODUCT_PHOTO">{t("Тауар суреті", "Фото товара")}</option>
                <option value="VEHICLE_PHOTO">{t("Көлік суреті", "Фото авто")}</option>
                <option value="CLIENT_REFERENCE">{t("Клиент анықтамасы", "Референс клиента")}</option>
                <option value="PAYMENT_RECEIPT">{t("Төлем чегі", "Чек оплаты")}</option>
                <option value="PRODUCTION_PHOTO">{t("Өндіріс суреті", "Фото производства")}</option>
                <option value="QC_PHOTO">{t("QC суреті", "Фото QC")}</option>
                <option value="INSTALLATION_PHOTO">{t("Орнату суреті", "Фото установки")}</option>
                <option value="OTHER">{t("Басқа", "Другое")}</option>
              </select>
              <input
                name="url"
                placeholder={t("Сурет/файл сілтемесі (URL)", "Ссылка на файл (URL)")}
                className="flex-1 rounded-icon border border-border bg-page-bg px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-pill bg-page-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-border">
                {t("Қосу", "Добавить")}
              </button>
            </form>
            {order.attachments.length === 0 ? (
              <p className="text-sm text-text-secondary">{t("Файл жоқ", "Файлов нет")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {order.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {a.type}
                    </a>{" "}
                    <span className="text-text-secondary">· {a.uploadedBy.fullName}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <div className="flex flex-col gap-4">
            <Card title={t("Пікірлер", "Комментарии")}>
              <p className="mb-2 text-xs text-text-secondary">
                {t(
                  "@Цех, @Installer, @Delivery, @Склад, @Finance, @ROP немесе қызметкер атын белгілесеңіз — notification барады.",
                  "Отметьте @Цех, @Installer, @Delivery, @Склад, @Finance, @ROP или имя сотрудника — придёт уведомление."
                )}
              </p>
              <form action={addOrderCommentAction} className="mb-3 flex items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input name="body" placeholder={t("Пікір жазу...", "Написать комментарий...")} className="flex-1 rounded-icon border border-border bg-page-bg px-3 py-2 text-sm" />
                <button type="submit" className="rounded-pill bg-page-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-border">
                  {t("Жіберу", "Отправить")}
                </button>
              </form>
              <div className="flex flex-col gap-2">
                {order.comments.map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className="font-semibold text-text-primary">{c.author.fullName}</span>{" "}
                    <span className="text-text-secondary">· {dateFmt.format(c.createdAt)}</span>
                    <p className="text-text-primary">{c.body}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card title={t("Статус тарихы", "История статусов")}>
              <ul className="flex flex-col gap-2 text-sm">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <span className="text-text-secondary">{dateFmt.format(h.changedAt)}</span>
                    <span className="text-text-primary">
                      {h.changedBy.fullName} — {h.fromStatus ? `${statusLabel[h.fromStatus]} → ` : ""}
                      {statusLabel[h.toStatus]}
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
                          {a.actor?.employee?.fullName ?? a.actor?.email ?? t("Жүйе", "Система")} — {a.action} ({a.entityType})
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
        )}
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}

const editInputClass =
  "rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";

function EditYesNo({ name, defaultValue, locale }: { name: string; defaultValue?: boolean; locale: "kk" | "ru" }) {
  return (
    <select name={name} defaultValue={defaultValue ? "yes" : "no"} className={editInputClass}>
      <option value="no">{tr(locale, { kk: "Жоқ", ru: "Нет" })}</option>
      <option value="yes">{tr(locale, { kk: "Иә", ru: "Да" })}</option>
    </select>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function SmallButton({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="rounded-pill bg-page-bg px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-border">
      {children}
    </button>
  );
}

function ActionForm({
  action,
  orderId,
  label,
  primary,
  small,
  extra,
}: {
  action: (formData: FormData) => void | Promise<void>;
  orderId: string;
  label: string;
  primary?: boolean;
  small?: boolean;
  extra?: Record<string, string>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      {extra &&
        Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button
        type="submit"
        className={`rounded-pill font-semibold transition-colors ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${
          primary ? "bg-accent text-white hover:bg-accent-hover" : "bg-page-bg text-text-primary hover:bg-border"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
