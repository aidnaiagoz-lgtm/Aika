import Link from "next/link";
import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { listMaterials, getWarehouseKpis, LOW_STOCK_THRESHOLD } from "@/lib/domain/warehouse";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { formatTenge } from "@/lib/order-labels";
import { createMaterialAction, adjustStockAction } from "./actions";

function categoryLabel(locale: "kk" | "ru"): Record<string, string> {
  return locale === "ru"
    ? {
        LEATHER: "Кожа",
        THREAD: "Нить",
        EDGING: "Окантовка",
        EVA: "EVA",
        CARPET: "Ковролин",
        FISHING_LINE: "Леска",
        ACCESSORIES: "Аксессуар",
      }
    : {
        LEATHER: "Былғары",
        THREAD: "Жіп",
        EDGING: "Кант",
        EVA: "EVA",
        CARPET: "Кілем",
        FISHING_LINE: "Леска",
        ACCESSORIES: "Аксессуар",
      };
}

interface Filters {
  category?: string;
  search?: string;
  lowStockOnly?: string;
  error?: string;
}

export default async function WarehouseDepartmentPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const CATEGORY_LABEL = categoryLabel(locale);
  const filters = await searchParams;

  try {
    const [materials, kpis] = await Promise.all([
      listMaterials(user, { ...filters, lowStockOnly: filters.lowStockOnly === "1" }),
      getWarehouseKpis(user),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold text-text-primary">{t("Қойма", "Склад")}</h1>

        {filters.error && (
          <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{filters.error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi label={t("Материалдар саны", "Количество материалов")} value={String(kpis.totalMaterials)} />
          <Kpi label={t("Қойма құны", "Стоимость склада")} value={formatTenge(kpis.totalValue)} />
          <Kpi label={t("Аз қалғандар", "Заканчиваются")} value={String(kpis.lowStockCount)} hint={`≤ ${LOW_STOCK_THRESHOLD}`} />
          <Kpi label={t("Категория саны", "Количество категорий")} value={String(kpis.byCategory.length)} />
        </div>

        <Card>
          <form className="grid grid-cols-2 gap-3 sm:grid-cols-4" method="GET">
            <Field label={t("Іздеу", "Поиск")}>
              <input name="search" defaultValue={filters.search} placeholder={t("Атауы / SKU / жеткізуші", "Название / SKU / поставщик")} className={inputClass} />
            </Field>
            <Field label={t("Категория", "Категория")}>
              <select name="category" defaultValue={filters.category ?? ""} className={inputClass}>
                <option value="">{t("Барлығы", "Все")}</option>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-text-secondary">
              <input type="checkbox" name="lowStockOnly" value="1" defaultChecked={filters.lowStockOnly === "1"} />
              {t("Тек аз қалғандар", "Только заканчивающиеся")}
            </label>
            <button type="submit" className="self-end rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
              {t("Сүзу", "Фильтр")}
            </button>
          </form>
        </Card>

        <Card title={t("Материалдар", "Материалы")}>
          {materials.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("Материал табылмады", "Материалы не найдены")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-secondary">
                    <th className="pb-2 pr-4 font-semibold">{t("SKU / Атауы", "SKU / Название")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Категория", "Категория")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Түсі", "Цвет")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Қолжетімді", "Доступно")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Резерв", "Резерв")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Құны (бірлік)", "Цена (ед.)")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Жеткізуші", "Поставщик")}</th>
                    <th className="pb-2 pr-4 font-semibold">{t("Қозғалыс", "Движение")}</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id} className="border-t border-border align-top">
                      <td className="py-2 pr-4">
                        <Link href={`/departments/warehouse/${m.id}`} className="font-medium text-accent hover:underline">
                          {m.name}
                        </Link>
                        <div className="text-xs text-text-secondary">{m.sku}</div>
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">{CATEGORY_LABEL[m.category] ?? m.category}</td>
                      <td className="py-2 pr-4 text-text-secondary">{m.color ?? "—"}</td>
                      <td className={`py-2 pr-4 tabular-nums font-semibold ${m.availableStock <= LOW_STOCK_THRESHOLD ? "text-danger" : "text-text-primary"}`}>
                        {m.availableStock.toFixed(1)} {m.unit}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-text-secondary">
                        {Number(m.reservedStock).toFixed(1)} {m.unit}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-text-secondary">{formatTenge(m.costPrice)}</td>
                      <td className="py-2 pr-4 text-text-secondary">{m.supplier ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <form action={adjustStockAction} className="flex flex-wrap items-center gap-1">
                          <input type="hidden" name="materialId" value={m.id} />
                          <select name="direction" className="rounded-icon border border-border bg-page-bg px-1.5 py-1 text-xs">
                            <option value="in">{t("+ Түсім", "+ Приход")}</option>
                            <option value="out">{t("− Шығыс", "− Расход")}</option>
                          </select>
                          <input name="amount" type="number" min={0} step="0.1" placeholder={t("мөлш.", "кол-во")} className="w-16 rounded-icon border border-border bg-page-bg px-1.5 py-1 text-xs" />
                          <input name="reason" placeholder={t("себебі", "причина")} className="w-24 rounded-icon border border-border bg-page-bg px-1.5 py-1 text-xs" />
                          <button type="submit" className="rounded-pill bg-page-bg px-2 py-1 text-xs font-semibold text-text-primary hover:bg-border">
                            OK
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

        <Card title={t("Категория бойынша қойма құны", "Стоимость склада по категориям")}>
          <RankTable rows={kpis.byCategory.map((c) => ({ key: CATEGORY_LABEL[c.category] ?? c.category, value: c.value }))} noData={t("Дерек жоқ", "Нет данных")} />
        </Card>

        <Card title={t("Жаңа материал қосу", "Добавить материал")}>
          <form action={createMaterialAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="SKU">
              <input name="sku" required className={inputClass} />
            </Field>
            <Field label={t("Атауы", "Название")}>
              <input name="name" required className={inputClass} />
            </Field>
            <Field label={t("Категория", "Категория")}>
              <select name="category" className={inputClass}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Түсі", "Цвет")}>
              <input name="color" className={inputClass} />
            </Field>
            <Field label={t("Өлшем бірлігі", "Ед. измерения")}>
              <input name="unit" defaultValue="м²" className={inputClass} />
            </Field>
            <Field label={t("Бастапқы қалдық", "Начальный остаток")}>
              <input name="initialStock" type="number" min={0} step="0.1" defaultValue={0} className={inputClass} />
            </Field>
            <Field label={t("Құны (бірлік)", "Цена (ед.)")}>
              <input name="costPrice" type="number" min={0} step="0.01" defaultValue={0} className={inputClass} />
            </Field>
            <Field label={t("Жеткізуші", "Поставщик")}>
              <input name="supplier" className={inputClass} />
            </Field>
            <button type="submit" className="col-span-full w-fit rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
              {t("Қосу", "Добавить")}
            </button>
          </form>
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

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-icon border border-border bg-page-bg p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-bold text-text-primary">{value}</p>
      {hint && <p className="text-[10px] text-text-secondary">{hint}</p>}
    </div>
  );
}

function RankTable({ rows, noData }: { rows: { key: string; value: number }[]; noData: string }) {
  if (rows.length === 0) return <p className="text-sm text-text-secondary">{noData}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate text-text-secondary">{r.key}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums text-text-primary">{formatTenge(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
