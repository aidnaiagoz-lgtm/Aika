"use client";

import { useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { uploadPhotosAction } from "../actions";

/** Кожа фотолары: бірнеше суретті бірден таңдайды, атауы — коды («4050.jpg»). 8-ден бөліп жібереді. */
export function PhotoUpload() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const onFiles = (list: FileList) =>
    start(async () => {
      setMsg(null);
      const files = [...list];
      let saved = 0;
      const unknown: string[] = [];
      for (let i = 0; i < files.length; i += 8) {
        setProgress(`${Math.min(i + 8, files.length)} / ${files.length}`);
        const form = new FormData();
        for (const f of files.slice(i, i + 8)) form.append("files", f);
        const r = await uploadPhotosAction(form);
        if (!r.ok) {
          setProgress(null);
          return setMsg({ ok: false, text: r.error });
        }
        saved += r.saved.length;
        unknown.push(...r.unknown);
      }
      setProgress(null);
      setMsg({
        ok: true,
        text: `✓ ${saved} фото сақталды${unknown.length ? ` · коды табылмады: ${unknown.slice(0, 8).join(", ")}${unknown.length > 8 ? "…" : ""}` : ""}`,
      });
    });

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
      <div>
        <h2 className="m-0 text-base font-bold text-text-primary">Кожа фотолары</h2>
        <p className="m-0 mt-1 text-sm text-text-secondary">
          Бірнеше суретті бірден таңдаңыз. Әр файлдың атауы — кожаның <b>коды</b>: <code>4050.jpg</code>, <code>4007.png</code>. Бұрынғы фото ауысады.
        </p>
      </div>
      <label className={`flex w-fit cursor-pointer items-center gap-2 rounded-pill border border-border px-4 py-2.5 text-sm font-semibold hover:bg-page-bg ${pending ? "opacity-60" : ""}`}>
        <ImagePlus size={17} className="text-accent" />
        {pending ? `Жүктелуде… ${progress ?? ""}` : "Фотоларды таңдау"}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={pending} onChange={(e) => e.target.files?.length && onFiles(e.target.files)} />
      </label>
      {msg && <p className={`m-0 text-sm font-semibold ${msg.ok ? "text-[#15803d]" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}
