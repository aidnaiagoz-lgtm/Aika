import Link from "next/link";
import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listProductionQueue, listWorkshops, listProductionWorkers } from "@/lib/domain/production";
import { getProductionKpis } from "@/lib/domain/orders";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { productionStageLabel, PRODUCTION_STAGE_TONE, PRODUCTION_STAGE_OPTIONS, priorityLabel } from "@/lib/order-labels";
import { assignWorkerAction, setWorkshopAction, advanceStageAction, recordQualityCheckAction } from "./actions";

interface Filters {
  status?: string;
  workshop?: string;
  assignedWorkerId?: string;
  priority?: string;
  onlyMine?: string;
  error?: string;
}

export default async function ProductionDepartmentPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const stageLabel = productionStageLabel(locale);
  const prioLabel = priorityLabel(locale);
  const filters = await searchParams;

  try {
    const [queue, workshops, workers, kpis] = await Promise.all([
      listProductionQueue(user, { ...filters, onlyMine: filters.onlyMine === "1" }),
      listWorkshops(),
      listProductionWorkers(),
      getProductionKpis(user),
    ]);

    const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { day: "2-digit", month: "2-digit" });

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">{t("Өндіріс / Цех", "Производство / Цех")}</h1>
        </div>

        {filters.error && (
          <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{filters.error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label={t("Дайын болды", "Готово")} value={String(kpis.produced)} />
          <Kpi label={t("Кезекте", "В очереди")} value={String(queue.length)} />
          <Kpi label={t("Орташа өндіру уақыты", "Среднее время производства")} value={`${kpis.avgProductionHours.toFixed(1)} ${t("сағ", "ч")}`} />
          <Kpi label={t("Кешіккен", "Просрочено")} value={String(kpis.delayed)} />
          <Kpi label={t("Брак / Қайта жасау", "Брак / Переделка")} value={`${kpis.defectRate.toFixed(0)}% / ${kpis.reworkRate.toFixed(0)}%`} />
        </div>

        <Card>
          <form className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" method="GET">
            <Field label={t("Статус", "Статус")}>
              <select name="status" defaultValue={filters.status ?? ""} className={selectClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {["NEW", "QUEUED", "CUTTING", "ASSEMBLY", "EDGING", "LOGO", "QUALITY_CHECK", "READY", "REWORK", "DEFECT"].map((s) => (
                  <option key={s} value={s}>
                    {stageLabel[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Цех", "Цех")}>
              <select name="workshop" defaultValue={filters.workshop ?? ""} className={selectClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {workshops.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Жұмысшы", "Работник")}>
              <select name="assignedWorkerId" defaultValue={filters.assignedWorkerId ?? ""} className={selectClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Приоритет", "Приоритет")}>
              <select name="priority" defaultValue={filters.priority ?? ""} className={selectClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {Object.entries(prioLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-text-secondary">
              <input type="checkbox" name="onlyMine" value="1" defaultChecked={filters.onlyMine === "1"} />
              {t("Тек менің кезегім", "Только моя очередь")}
            </label>
            <button type="submit" className="self-end rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
              {t("Сүзу", "Фильтр")}
            </button>
          </form>
        </Card>

        <Card title={t("Өндіріс кезегі", "Очередь производства")}>
          {queue.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("Кезекте заказ жоқ", "В очереди заказов нет")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-2 pr-4 font-semibold">{t("Заказ", "Заказ")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Тауар", "Товар")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Приоритет", "Приоритет")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Дедлайн", "Дедлайн")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Статус", "Статус")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Цех", "Цех")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Жұмысшы", "Работник")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Соңғы QC", "Последний QC")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Әрекет", "Действие")}</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((po) => {
                    const isOverdue = po.order.deadline && po.order.deadline < new Date() && po.status !== "READY";
                    const nextOptions = PRODUCTION_STAGE_OPTIONS.filter((s) => s !== po.status);
                    return (
                      <tr key={po.id} className="border-t border-border align-top">
                        <td className="py-2 pr-4">
                          <Link href={`/orders/${po.order.id}`} className="font-medium text-accent hover:underline">
                            {po.order.orderNumber}
                          </Link>
                          <div className="text-xs text-text-secondary">{po.order.customer.fullName}</div>
                        </td>
                        <td className="py-2 pr-4 text-text-primary">{po.orderItem?.product.name ?? "—"}</td>
                        <td className="py-2 pr-4 text-text-secondary">{prioLabel[po.order.priority]}</td>
                        <td className={`py-2 pr-4 tabular-nums ${isOverdue ? "font-bold text-danger" : "text-text-secondary"}`}>
                          {po.order.deadline ? dateFmt.format(po.order.deadline) : "—"} {isOverdue && `· ${t("МЕРЗІМІ ӨТТІ", "СРОК ПРОШЁЛ")}`}
                        </td>
                        <td className="py-2 pr-4">
                          <StatusBadge tone={PRODUCTION_STAGE_TONE[po.status]}>{stageLabel[po.status]}</StatusBadge>
                        </td>
                        <td className="py-2 pr-4">
                          <form action={setWorkshopAction} className="flex items-center gap-1">
                            <input type="hidden" name="productionOrderId" value={po.id} />
                            <input name="workshop" defaultValue={po.workshop ?? ""} placeholder="—" className="w-24 rounded-icon border border-border bg-page-bg px-2 py-1 text-xs" />
                            <SmallButton>OK</SmallButton>
                          </form>
                        </td>
                        <td className="py-2 pr-4">
                          <form action={assignWorkerAction} className="flex items-center gap-1">
                            <input type="hidden" name="productionOrderId" value={po.id} />
                            <select name="workerId" defaultValue={po.assignedWorkerId ?? ""} className="rounded-icon border border-border bg-page-bg px-2 py-1 text-xs">
                              <option value="">—</option>
                              {workers.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.fullName}
                                </option>
                              ))}
                            </select>
                            <SmallButton>OK</SmallButton>
                          </form>
                        </td>
                        <td className="py-2 pr-4 text-xs text-text-secondary">{po.qualityChecks[0]?.result ?? "—"}</td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-col gap-1.5">
                            {po.status !== "READY" && po.status !== "CANCELLED" && (
                              <form action={advanceStageAction} className="flex items-center gap-1">
                                <input type="hidden" name="productionOrderId" value={po.id} />
                                <select name="toStatus" className="rounded-icon border border-border bg-page-bg px-2 py-1 text-xs">
                                  {nextOptions.map((s) => (
                                    <option key={s} value={s}>
                                      {stageLabel[s]}
                                    </option>
                                  ))}
                                </select>
                                <SmallButton>{t("Ауыстыру", "Сменить")}</SmallButton>
                              </form>
                            )}
                            {po.status === "QUALITY_CHECK" && (
                              <form action={recordQualityCheckAction} className="flex items-center gap-1">
                                <input type="hidden" name="productionOrderId" value={po.id} />
                                <select name="result" className="rounded-icon border border-border bg-page-bg px-2 py-1 text-xs">
                                  <option value="PASSED">{t("QC: Өтті", "QC: Прошёл")}</option>
                                  <option value="FAILED">{t("QC: Өтпеді", "QC: Не прошёл")}</option>
                                  <option value="REWORK_REQUIRED">{t("QC: Қайта жасау", "QC: На переделку")}</option>
                                </select>
                                <SmallButton>{t("Жазу", "Записать")}</SmallButton>
                              </form>
                            )}
                          </div>
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

const selectClass =
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

function SmallButton({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="rounded-pill bg-page-bg px-2 py-1 text-xs font-semibold text-text-primary hover:bg-border">
      {children}
    </button>
  );
}
