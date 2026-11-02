"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createTrainingFolderAction } from "./actions";
import type { TrainingSection } from "@/lib/domain/training";

export function CreateFolderForm({
  section,
  createLabel,
  nameLabel,
  submitLabel,
  cancelLabel,
}: {
  section: TrainingSection;
  createLabel: string;
  nameLabel: string;
  submitLabel: string;
  cancelLabel: string;
}) {
  const [open, setOpen] = useState(false);
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
      action={async (formData) => {
        await createTrainingFolderAction(formData);
        formRef.current?.reset();
        setOpen(false);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="section" value={section} />
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
        className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        {submitLabel}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={cancelLabel}
        className="rounded-pill p-2 text-text-secondary transition-colors hover:bg-page-bg"
      >
        <X size={16} />
      </button>
    </form>
  );
}
