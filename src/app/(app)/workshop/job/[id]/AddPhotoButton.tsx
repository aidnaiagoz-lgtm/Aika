"use client";

import { useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { addMissingPhotoAction } from "../../actions";
import { resizeImage } from "../../../warehouse/resize";

/** Фотосы жоқ материал: «Фото қосу» — телефонда бірден камера ашылады. */
export function AddPhotoButton({ materialId }: { materialId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <label
      title={error ?? "Фото қосу"}
      className={`flex h-12 w-12 shrink-0 cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed text-[10px] font-semibold ${
        error ? "border-danger/50 text-danger" : "border-border text-text-secondary hover:border-accent/50 hover:text-accent"
      } ${pending ? "opacity-60" : ""}`}
    >
      <Camera size={16} />
      {pending ? "…" : "Фото"}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={pending}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          start(async () => {
            const form = new FormData();
            form.append("files", await resizeImage(f, 1000, 0.85));
            const r = await addMissingPhotoAction(materialId, form);
            setError(r.ok ? null : r.error);
          });
        }}
      />
    </label>
  );
}
