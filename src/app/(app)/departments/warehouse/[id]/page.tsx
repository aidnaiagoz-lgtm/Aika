import Link from "next/link";
import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getMaterial, getMaterialMovementHistory } from "@/lib/domain/warehouse";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { formatTenge } from "@/lib/order-labels";
import { updateMaterialAction, deactivateMaterialAction } from "../actions";

export default async function MaterialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const { id } = await params;
  const { error } = await searchParams;

  try {
    const [material, history] = await Promise.all([getMaterial(user, id), getMaterialMovementHistory(user, id)]);
    const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { dateStyle: "medium", timeStyle: "short" });

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{material.name}</h1>
            <p className="text-sm text-text-secondary">{material.sku}</p>
          </div>
          <Link href="/departments/warehouse" className="text-sm font-medium text-accent hover:underline">
            {t("← Қоймаға оралу", "← Назад к складу")}
          </Link>
        </div>

        {error && (
          <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi label={t("Қолжетімді", "Доступно")} value={`${material.availableStock.toFixed(1)} ${material.unit}`} />
          <Kpi label={t("Резерв", "Резерв")} value={`${Number(material.reservedStock).toFixed(1)} ${material.unit}`} />
          <Kpi label={t("Жалпы қалдық", "Общий остаток")} value={`${Number(material.currentStock).toFixed(1)} ${material.unit}`} />
          <Kpi label={t("Жалпы құн", "Общая стоимость")} value={formatTenge(Number(material.currentStock) * Number(material.costPrice))} />
        </div>

        <Card title={t("Мәліметтер", "Данные")}>
          <form action={updateMaterialAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input type="hidden" name="materialId" value={material.id} />
            <Field label={t("Атауы", "Название")}>
              <input name="name" defaultValue={material.name} className={inputClass} />
            </Field>
            <Field label={t("Түсі", "Цвет")}>
              <input name="color" defaultValue={material.color ?? ""} className={inputClass} />
            </Field>
            <Field label={t("Түрі", "Тип")}>
              <input name="type" defaultValue={material.type ?? ""} className={inputClass} />
            </Field>
            <Field label={t("Өлшем бірлігі", "Ед. измерения")}>
              <input name="unit" defaultValue={material.unit} className={inputClass} />
            </Field>
            <Field label={t("Құны (бірлік)", "Цена (ед.)")}>
              <input name="costPrice" type="number" min={0} step="0.01" defaultValue={material.costPrice.toString()} className={inputClass} />
            </Field>
            <Field label={t("Жеткізуші", "Поставщик")}>
              <input name="supplier" defaultValue={material.supplier ?? ""} className={inputClass} />
            </Field>
            <button type="submit" className="col-span-full w-fit rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
              {t("Сақтау", "Сохранить")}
            </button>
          </form>
          <form action={deactivateMaterialAction} className="mt-3 border-t border-border pt-3">
            <input type="hidden" name="materialId" value={material.id} />
            <button type="submit" className="rounded-pill bg-page-bg px-3 py-1.5 text-xs font-semibold text-danger hover:bg-border">
              {t("Каталогтан жасыру (деактивация)", "Скрыть из каталога (деактивация)")}
            </button>
          </form>
        </Card>

        <Card title={t("Қозғалыс тарихы", "История движения")}>
          {history.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("Қозғалыс жоқ", "Движений нет")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {history.map((h) => {
                const newVal = h.newValue as { currentStock?: number; delta?: number; reason?: string } | null;
                return (
                  <li key={h.id} className="border-b border-border pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-text-secondary">{dateFmt.format(h.createdAt)}</span>
                      <span className="font-medium text-text-primary">
                        {h.actor?.employee?.fullName ?? h.actor?.email ?? t("Жүйе", "Система")} — {h.action}
                      </span>
                    </div>
                    {newVal && (
                      <p className="pl-1 text-xs text-text-secondary">
                        {newVal.delta !== undefined && `${newVal.delta > 0 ? "+" : ""}${newVal.delta} ${material.unit}`}
                        {newVal.currentStock !== undefined && ` → ${t("қалдық", "остаток")}: ${newVal.currentStock} ${material.unit}`}
                        {newVal.reason && ` (${newVal.reason})`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-icon border border-border bg-page-bg p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-bold text-text-primary">{value}</p>
    </div>
  );
}
