import { DepartmentTabs } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex flex-col gap-6">
      <DepartmentTabs
        title={t.sidebar.departmentNames.sales}
        basePath="/departments/sales"
        locale={locale}
        extraTabs={[{ slug: "almaty", label: t.sales.tabAlmaty }]}
      />
      {children}
    </div>
  );
}
