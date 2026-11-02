import { Folder } from "lucide-react";
import { Card } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listTrainingFolders, type TrainingSection } from "@/lib/domain/training";
import { CreateFolderForm } from "./CreateFolderForm";

/** Құжат қоймасы: папкалар тізімі + жаңа папка құру. Болашақта әр папканың
 *  ішіне PDF/Word/видео/фото файлдар жүктелетін болады (TrainingFolder-ге
 *  байланысты жаңа файл кестесі арқылы) — қазір тек папка құрылымы дайын. */
export async function FolderSection({ section }: { section: TrainingSection }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const folders = await listTrainingFolders(section);

  return (
    <Card
      title={t.training.foldersTitle}
      action={
        <CreateFolderForm
          section={section}
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
  );
}
