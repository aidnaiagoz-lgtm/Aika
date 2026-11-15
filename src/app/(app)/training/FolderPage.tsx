import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, FileText, Link2, PlayCircle } from "lucide-react";
import { Card } from "@/lib/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canManage, getTrainingFolder, isFileStorageConfigured, type TrainingSection } from "@/lib/domain/training";
import { FolderSection } from "./FolderSection";
import { AddLinkForm, DeleteMaterialButton, FolderHeader, UploadPdfButton } from "./FolderControls";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function linkIcon(url: string) {
  const host = new URL(url).hostname;
  if (/youtube\.com|youtu\.be|vimeo\.com|instagram\.com|tiktok\.com/.test(host)) return PlayCircle;
  if (/docs\.google\.com|drive\.google\.com|dropbox\.com|disk\.yandex/.test(host)) return FileText;
  return Link2;
}

export async function FolderPage({ section, folderId }: { section: TrainingSection; folderId: string }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = getDictionary(await getLocale());
  const data = await getTrainingFolder(section, folderId);
  if (!data) notFound();
  const { folder, path } = data;
  const sectionName = section === "qualification" ? t.training.qualificationLabel : t.training.provisionLabel;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-text-secondary">
          <Link href={`/training/${section}`} className="hover:text-accent hover:underline">
            {sectionName}
          </Link>
          {path.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <ChevronRight size={14} />
              <Link href={`/training/${section}/${p.id}`} className="hover:text-accent hover:underline">
                {p.name}
              </Link>
            </span>
          ))}
          <ChevronRight size={14} />
          <span className="font-semibold text-text-primary">{folder.name}</span>
        </nav>
        <FolderHeader
          key={folder.name}
          section={section}
          id={folder.id}
          name={folder.name}
          canManage={canManage(user, folder.createdById)}
          labels={{
            rename: t.training.rename,
            save: t.training.save,
            cancel: t.training.cancel,
            delete: t.training.delete,
            confirmDelete: t.training.confirmDeleteFolder(folder.name),
          }}
        />
      </div>

      <FolderSection section={section} parentId={folder.id} />

      <Card
        title={t.training.materialsTitle}
        action={
          <div className="flex flex-wrap items-start justify-end gap-2">
            <UploadPdfButton
              section={section}
              folderId={folder.id}
              storageReady={isFileStorageConfigured()}
              labels={{
                upload: t.training.uploadPdf,
                uploading: t.training.uploading,
                errors: t.training.errors,
                genericError: t.training.genericError,
              }}
            />
            <AddLinkForm
              section={section}
              folderId={folder.id}
              labels={{
                addLink: t.training.addLink,
                titlePlaceholder: t.training.linkTitlePlaceholder,
                urlPlaceholder: t.training.linkUrlPlaceholder,
                add: t.training.add,
                cancel: t.training.cancel,
              }}
            />
          </div>
        }
      >
        {folder.materials.length === 0 ? (
          <p className="text-sm text-text-secondary">{t.training.noMaterials}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {folder.materials.map((m) => {
              const isPdf = m.kind === "pdf";
              const Icon = isPdf ? FileText : linkIcon(m.url);
              const href = isPdf ? `/api/training/file/${m.id}` : m.url;
              const source = isPdf ? `PDF${m.fileSize ? ` · ${formatSize(m.fileSize)}` : ""}` : new URL(m.url).hostname.replace(/^www\./, "");
              const author = m.createdBy.employee?.fullName ?? m.createdBy.email;
              return (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
                    <Icon size={18} />
                  </span>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary group-hover:text-accent">
                      <span className="truncate">{m.title}</span>
                      <ExternalLink size={13} className="shrink-0 opacity-60" />
                    </span>
                    <span className="truncate text-xs text-text-secondary">
                      {source} · {t.training.addedBy}: {author}
                    </span>
                  </a>
                  {canManage(user, m.createdById) && (
                    <DeleteMaterialButton
                      section={section}
                      id={m.id}
                      label={t.training.delete}
                      confirmText={t.training.confirmDeleteMaterial(m.title)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
