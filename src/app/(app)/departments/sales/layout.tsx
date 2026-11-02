import { DepartmentTabs } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getCurrentUser } from "@/lib/auth";
import { isSalesManagerOnly } from "@/lib/access";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  // Сатушы-менеджер тек «Продажи» кестесін көреді — басқа сату қойындылары жасырын.
  if (user && isSalesManagerOnly(user)) return <div className="flex flex-col gap-6">{children}</div>;

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
