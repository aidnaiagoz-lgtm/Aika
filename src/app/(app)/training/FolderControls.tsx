"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addTrainingFileAction,
  addTrainingLinkAction,
  deleteTrainingFolderAction,
  deleteTrainingMaterialAction,
  renameTrainingFolderAction,
} from "./actions";

const inputCls =
  "min-w-0 rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";
const primaryBtn =
  "rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60";
const ghostBtn =
  "flex items-center gap-1.5 rounded-pill border border-border px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-page-bg disabled:opacity-60";

/** Папка тақырыбы + «Атын өзгерту» / «Өшіру». */
export function FolderHeader({
  section,
  id,
  name,
  canManage,
  labels,
}: {
  section: string;
  id: string;
  name: string;
  canManage: boolean;
  labels: { rename: string; save: string; cancel: string; delete: string; confirmDelete: string };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await renameTrainingFolderAction(section, id, value);
            if (!r.ok) return setError(r.error);
            setError(null);
            setEditing(false);
          });
        }}
        className="flex flex-col gap-1"
      >
        <div className="flex flex-wrap items-center gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus className={`${inputCls} text-base font-bold`} />
          <button type="submit" disabled={pending} className={primaryBtn}>
            {labels.save}
          </button>
          <button
            type="button"
            aria-label={labels.cancel}
            onClick={() => {
              setEditing(false);
              setValue(name);
              setError(null);
            }}
            className="rounded-pill p-2 text-text-secondary hover:bg-page-bg"
          >
            <X size={16} />
          </button>
        </div>
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-xl font-bold text-text-primary">{name}</h1>
        {canManage && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} className={ghostBtn}>
              <Pencil size={14} /> {labels.rename}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(labels.confirmDelete)) return;
                start(async () => {
                  const r = await deleteTrainingFolderAction(section, id);
                  if (!r.ok) return setError(r.error);
                  router.push(r.redirectTo ?? `/training/${section}`);
                });
              }}
              className={`${ghostBtn} text-danger`}
            >
              <Trash2 size={14} /> {labels.delete}
            </button>
          </div>
        )}
      </div>
      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function AddLinkForm({
  section,
  folderId,
  labels,
}: {
  section: string;
  folderId: string;
  labels: { addLink: string; titlePlaceholder: string; urlPlaceholder: string; add: string; cancel: string };
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        <Plus size={16} /> {labels.addLink}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) =>
        start(async () => {
          const r = await addTrainingLinkAction(formData);
          if (!r.ok) return setError(r.error);
          formRef.current?.reset();
          setError(null);
          setOpen(false);
        })
      }
      className="flex w-full flex-col gap-1 sm:w-auto"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="section" value={section} />
        <input type="hidden" name="folderId" value={folderId} />
        <input name="title" placeholder={labels.titlePlaceholder} className={`${inputCls} sm:w-56`} />
        <input name="url" required autoFocus placeholder={labels.urlPlaceholder} className={`${inputCls} sm:w-64`} />
        <button type="submit" disabled={pending} className={primaryBtn}>
          {labels.add}
        </button>
        <button
          type="button"
          aria-label={labels.cancel}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-pill p-2 text-text-secondary hover:bg-page-bg"
        >
          <X size={16} />
        </button>
      </div>
      {error && <p className="m-0 text-xs text-danger">{error}</p>}
    </form>
  );
}

// Сервердегі шектермен бірдей (src/lib/domain/training): файл 20 МБ-қа дейін, 3 МБ-тық бөліктермен жіберіледі.
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const CHUNK_BYTES = 3 * 1024 * 1024;

function newUploadId() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

class UploadError extends Error {
  constructor(public readonly code?: string) {
    super(code ?? "upload failed");
  }
}

/** «PDF жүктеу»: файл бөлік-бөлігімен сайттың базасына жүктеледі, сосын материал ретінде папкаға қосылады. */
export function UploadPdfButton({
  section,
  folderId,
  labels,
}: {
  section: string;
  folderId: string;
  labels: { upload: string; uploading: string; errors: Record<string, string>; genericError: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onFile(file: File) {
    setError(null);
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) return setError(labels.errors.fileNotPdf);
    if (file.size > PDF_MAX_BYTES) return setError(labels.errors.fileTooLarge);
    setProgress(0);
    try {
      const uploadId = newUploadId();
      const total = Math.ceil(file.size / CHUNK_BYTES);
      for (let index = 0; index < total; index++) {
        const part = file.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES);
        const qs = new URLSearchParams({ folderId, uploadId, index: String(index) });
        let res: Response | null = null;
        // Интернет үзіліп кетсе — әр бөлікті 3 ретке дейін қайталаймыз.
        for (let attempt = 0; attempt < 3; attempt++) {
          res = await fetch(`/api/training/chunk?${qs}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: part }).catch(() => null);
          if (res && (res.ok || res.status < 500)) break;
        }
        if (!res?.ok) {
          const code = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : undefined;
          throw new UploadError(code);
        }
        setProgress(Math.round(((index + 1) / total) * 100));
      }
      const r = await addTrainingFileAction({
        section,
        folderId,
        title: file.name.replace(/\.pdf$/i, ""),
        uploadId,
        fileName: file.name,
        fileSize: file.size,
      });
      if (!r.ok) setError(r.error);
      else router.refresh();
    } catch (e) {
      // Сервер қайтарған күтілген қате (мыс. PDF емес) — тек хабар көрсетеміз; басқасы — консольге.
      const code = e instanceof UploadError ? e.code : undefined;
      if (!code) console.error("[training upload]", e instanceof Error ? e.message : e);
      setError((code && labels.errors[code]) || labels.errors.fileInvalid || labels.genericError);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button
        type="button"
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-pill border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-tint disabled:opacity-60"
      >
        <FileUp size={16} /> {progress === null ? labels.upload : `${labels.uploading} ${progress}%`}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function DeleteMaterialButton({ section, id, label, confirmText }: { section: string; id: string; label: string; confirmText: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          start(async () => {
            const r = await deleteTrainingMaterialAction(section, id);
            if (!r.ok) setError(r.error);
          });
        }}
        className="grid h-9 w-9 place-items-center rounded-icon text-text-secondary transition-colors hover:bg-page-bg hover:text-danger disabled:opacity-60"
      >
        <Trash2 size={16} />
      </button>
    </span>
  );
}
