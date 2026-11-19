"use client";

import { useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { setMaterialPhotoAction } from "../../actions";

/** Материалдың фотосы: басса — жаңа фото таңдау (ауыстыру). */
export function MaterialPhoto({ id, name, photo }: { id: string; name: string; photo: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <label title="Фотоны ауыстыру" className={`group relative flex h-[88px] w-[88px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[16px] bg-page-bg ${pending ? "opacity-60" : ""}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- базадан келетін кішкене сурет
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-1 text-[11px] font-semibold text-text-secondary">
          <ImagePlus size={20} /> Фото қосу
        </span>
      )}
      {photo && <span className="absolute inset-x-0 bottom-0 hidden bg-black/50 py-1 text-center text-[11px] font-semibold text-white group-hover:block">Ауыстыру</span>}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={pending}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const form = new FormData();
          form.append("files", f);
          start(async () => {
            const r = await setMaterialPhotoAction(id, form);
            setError(r.ok ? null : r.error);
          });
        }}
      />
      {error && <span className="absolute inset-x-0 top-0 bg-danger px-1 text-[10px] text-white">{error}</span>}
    </label>
  );
}
