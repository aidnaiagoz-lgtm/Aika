import { ComingSoon } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function ItDepartmentPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const name = t.sidebar.departmentNames["it"];

  return <ComingSoon title={name} badge={t.common.comingSoonBadge} message={t.common.comingSoonMessage(name)} />;
}
