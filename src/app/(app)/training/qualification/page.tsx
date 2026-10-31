import { Folder } from "lucide-react";
import { Card } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listTrainingFolders } from "@/lib/domain/training";
import { CreateFolderForm } from "../CreateFolderForm";

export default async function TrainingQualificationPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const name = t.training.qualificationLabel;
  const folders = await listTrainingFolders("qualification");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{name}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t.training.pageSubtitle}</p>
      </div>

      <Card
        title={t.training.foldersTitle}
        action={
          <CreateFolderForm
            section="qualification"
            createLabel={t.training.createFolder}
            nameLabel={t.training.folderNamePlaceholder}
            submitLabel={t.training.create}
            cancelLabel={t.training.cancel}
          />
        }
      >
        {folders.length === 0 ? (
          <p className="text-sm text-text-secondary">{t.training.noFolders}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {folders.map((folder) => (
              <div key={folder.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
                  <Folder size={18} />
                </span>
                <span className="text-sm font-semibold text-text-primary">{folder.name}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
