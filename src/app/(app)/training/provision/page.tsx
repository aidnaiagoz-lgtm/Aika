import { ComingSoon } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function TrainingProvisionPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const name = t.training.provisionLabel;

  return <ComingSoon title={name} badge={t.common.comingSoonBadge} message={t.training.emptyMessage(name)} />;
}
