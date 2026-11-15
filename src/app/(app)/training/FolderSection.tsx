import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import { Card } from "@/lib/ui";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listTrainingFolders, type TrainingSection } from "@/lib/domain/training";
import { CreateFolderForm } from "./CreateFolderForm";

/** Папкалар тізімі (бөлімнің басында немесе папка ішінде) + жаңа папка құру. */
export async function FolderSection({ section, parentId = null }: { section: TrainingSection; parentId?: string | null }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const folders = await listTrainingFolders(section, parentId);

  return (
    <Card
      title={parentId ? t.training.subfoldersTitle : t.training.foldersTitle}
      action={
        <CreateFolderForm
          section={section}
          parentId={parentId}
          createLabel={t.training.createFolder}
          nameLabel={t.training.folderNamePlaceholder}
          submitLabel={t.training.create}
          cancelLabel={t.training.cancel}
        />
      }
    >
      {folders.length === 0 ? (
        <p className="text-sm text-text-secondary">{parentId ? t.training.noSubfolders : t.training.noFolders}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {folders.map((folder) => (
            <Link
              key={folder.id}
              href={`/training/${section}/${folder.id}`}
              className="-mx-2 flex items-center gap-3 rounded-icon px-2 py-3 transition-colors hover:bg-page-bg"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
                <Folder size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-text-primary">{folder.name}</span>
                <span className="text-xs text-text-secondary">{t.training.itemsCount(folder._count.children, folder._count.materials)}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-text-secondary" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
