import { OrgChart } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function OrgStructurePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="-m-8 flex flex-col gap-6">
      <h1 className="px-8 pt-8 text-center text-xl font-bold text-text-primary">{t.orgStructure.pageTitle}</h1>
      <div className="shadow-card mx-8 rounded-card bg-accent-tint p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t.orgStructure.companyCkpLabel}</p>
        <p className="mt-1 text-sm text-text-primary">{t.orgStructure.companyCkp}</p>
      </div>
      <div className="shadow-card min-h-[70vh] border-t border-border bg-surface py-5">
        <OrgChart
          node={t.orgStructure.ceo}
          ckpLabel={t.orgStructure.ckpLabel}
          ckpEmpty={t.orgStructure.ckpEmpty}
          allCkpLabel={t.orgStructure.allCkpLabel}
        />
      </div>
    </div>
  );
}
