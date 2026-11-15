"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createTrainingFolderAction } from "./actions";
import type { TrainingSection } from "@/lib/domain/training";

export function CreateFolderForm({
  section,
  parentId,
  createLabel,
  nameLabel,
  submitLabel,
  cancelLabel,
}: {
  section: TrainingSection;
  parentId?: string | null;
  createLabel: string;
  nameLabel: string;
  submitLabel: string;
  cancelLabel: string;
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
        <Plus size={16} />
        {createLabel}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) =>
        start(async () => {
          const r = await createTrainingFolderAction(formData);
          if (!r.ok) return setError(r.error);
          formRef.current?.reset();
          setError(null);
          setOpen(false);
        })
      }
      className="flex flex-col items-end gap-1"
    >
      <div className="flex items-center gap-2">
        <input type="hidden" name="section" value={section} />
        {parentId && <input type="hidden" name="parentId" value={parentId} />}
        <input
          name="name"
          type="text"
          required
          autoFocus
          placeholder={nameLabel}
          className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          aria-label={cancelLabel}
          className="rounded-pill p-2 text-text-secondary transition-colors hover:bg-page-bg"
        >
          <X size={16} />
        </button>
      </div>
      {error && <p className="m-0 text-xs text-danger">{error}</p>}
    </form>
  );
}
