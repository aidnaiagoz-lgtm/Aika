"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
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
