import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { FolderSection } from "../FolderSection";

export default async function TrainingQualificationPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const name = t.training.qualificationLabel;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{name}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t.training.pageSubtitle}</p>
      </div>

      <FolderSection section="qualification" />
    </div>
  );
}
