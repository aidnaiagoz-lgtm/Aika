import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { FolderSection } from "../../training/FolderSection";

export default async function QualificationDepartmentPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const name = t.sidebar.departmentNames["qualification"];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{name}</h1>
      </div>

      <FolderSection section="qualification" />
    </div>
  );
}
