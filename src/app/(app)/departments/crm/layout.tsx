import { DepartmentTabs } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex flex-col gap-6">
      <DepartmentTabs
        title={t.sidebar.departmentNames.crm}
        basePath="/departments/crm"
        locale={locale}
        extraTabs={[{ slug: "customers", label: t.crm.tabCustomers }]}
      />
      {children}
    </div>
  );
}
