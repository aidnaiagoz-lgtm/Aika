import { notFound } from "next/navigation";
import { ComingSoon } from "@/lib/ui";
import { DEPARTMENT_SLUGS, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function TrainingDepartmentPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (!DEPARTMENT_SLUGS.includes(dept as (typeof DEPARTMENT_SLUGS)[number])) {
    notFound();
  }

  const locale = await getLocale();
  const t = getDictionary(locale);
  const name = t.sidebar.departmentNames[dept];

  return <ComingSoon title={name} badge={t.common.comingSoonBadge} message={t.training.emptyMessage(name)} />;
}
