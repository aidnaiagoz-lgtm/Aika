"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { answerLekalaAction, setMarkAction } from "./actions";

const btn = "whitespace-nowrap rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-page-bg disabled:opacity-50";

/** Жол әрекеттері: сұрауға жауап (Бар / Жоқ / Іздеймін) немесе белгі. */
export function LekalaRowActions({ make, model, status, requestId }: { make: string; model: string; status: "have" | "none" | "asked"; requestId: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const call = (p: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await p();
      setError(r.ok ? null : r.error ?? "Қате");
    });
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {requestId ? (
        <>
          <button type="button" disabled={pending} onClick={() => call(() => answerLekalaAction(requestId, "HAVE"))} className={`${btn} border-[#16a34a]/40 text-[#15803d]`}>
            ✓ Бар
          </button>
          <button type="button" disabled={pending} onClick={() => call(() => answerLekalaAction(requestId, "NONE"))} className={btn}>
            ✗ Жоқ
          </button>
          <button type="button" disabled={pending} onClick={() => call(() => answerLekalaAction(requestId, "SEARCHING"))} className={btn}>
            Іздеймін
          </button>
        </>
      ) : status === "have" ? (
        <button type="button" disabled={pending} onClick={() => call(() => setMarkAction(make, model, "NONE"))} className={`${btn} text-text-secondary`}>
          Жоқ деп белгілеу
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => call(() => setMarkAction(make, model, "HAVE"))} className={btn}>
          Бар деп белгілеу
        </button>
      )}
      {error && <span className="w-full text-right text-xs text-danger">{error}</span>}
    </div>
  );
}

/** «+ Лекала қосу»: тарихта жоқ көлікке «бар» белгісін қолмен қосу. */
export function AddLekala() {
  const [open, setOpen] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
        <Plus size={16} /> Лекала қосу
      </button>
    );
  const inp = "min-h-10 rounded-pill border border-border bg-surface px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className={inp} placeholder="Марка (мыс. Chery)" value={make} onChange={(e) => setMake(e.target.value)} />
      <input className={inp} placeholder="Модель (мыс. Tiggo 8 Pro)" value={model} onChange={(e) => setModel(e.target.value)} />
      <button
        type="button"
        disabled={pending || !make.trim() || !model.trim()}
        onClick={() =>
          start(async () => {
            const r = await setMarkAction(make, model, "HAVE");
            setMsg(r.ok ? { ok: true, text: "✓ Қосылды" } : { ok: false, text: r.error });
            if (r.ok) {
              setMake("");
              setModel("");
            }
          })
        }
        className="rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Сақтау
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-text-secondary">
        Жабу
      </button>
      {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-[#15803d]" : "text-danger"}`}>{msg.text}</span>}
    </div>
  );
}
