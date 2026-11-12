import Link from "next/link";
import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listDeletedOrders } from "@/lib/domain/orders";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { formatTenge } from "@/lib/order-labels";
import { restoreOrderAction } from "../actions";

export default async function OrdersArchivePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });

  let orders: Awaited<ReturnType<typeof listDeletedOrders>> | null = null;
  try {
    orders = await listDeletedOrders(user);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }

  const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">{t("Өшірілген заказдар (архив)", "Удалённые заказы (архив)")}</h1>
        <Link href="/orders" className="rounded-pill bg-page-bg px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-border">
          {t("← Заказдарға қайту", "← Назад к заказам")}
        </Link>
      </div>

      <Card title={t(`Архив (${orders.length})`, `Архив (${orders.length})`)}>
        {orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-secondary">{t("Өшірілген заказ жоқ", "Удалённых заказов нет")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-text-secondary">
                  <th className="pb-3 pr-4 font-semibold">{t("Заказ №", "Заказ №")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("Клиент", "Клиент")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("Сома", "Сумма")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("Менеджер", "Менеджер")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("Кім өшірді", "Кто удалил")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("Қашан өшірілді", "Когда удалён")}</th>
                  <th className="pb-3 pr-4 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-border align-top hover:bg-page-bg/50">
                    <td className="py-3 pr-4 font-semibold text-text-primary">{o.orderNumber}</td>
                    <td className="py-3 pr-4 text-text-primary">{o.customer.fullName}</td>
                    <td className="py-3 pr-4 font-semibold tabular-nums text-text-primary">{formatTenge(o.finalAmount)}</td>
                    <td className="py-3 pr-4 text-text-secondary">{o.salesManager.fullName}</td>
                    <td className="py-3 pr-4 text-text-secondary">{o.deletedBy?.fullName ?? "—"}</td>
                    <td className="py-3 pr-4 text-text-secondary">{o.deletedAt ? dateFmt.format(o.deletedAt) : "—"}</td>
                    <td className="py-3 pr-4">
                      <form action={restoreOrderAction}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <button
                          type="submit"
                          className="rounded-pill bg-accent-tint px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
                        >
                          {t("Қалпына келтіру", "Восстановить")}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
