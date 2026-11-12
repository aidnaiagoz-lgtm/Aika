"use client";

import { useState, useTransition } from "react";
import { addWorkerAction, setWorkerActiveAction } from "../actions";

export function WorkersEditor({ workers }: { workers: Array<{ id: string; name: string; active: boolean }> }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addWorkerAction(name);
            if (r.ok) setName("");
            setError(r.ok ? null : r.error);
          });
        }}
      >
        <label htmlFor="worker-name" className="sr-only">
          Қызметкердің аты
        </label>
        <input
          id="worker-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Жаңа қызметкердің аты"
          className="min-h-12 flex-1 rounded-icon border border-border bg-surface px-3 text-[15px]"
        />
        <button type="submit" disabled={pending || !name.trim()} className="min-h-12 rounded-icon bg-accent px-5 text-[15px] font-bold text-white disabled:opacity-60">
          Қосу
        </button>
      </form>
      {error && <p className="m-0 text-sm text-danger">{error}</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {workers.map((w) => (
          <li key={w.id} className="flex min-h-14 items-center justify-between gap-3 rounded-card bg-surface px-4 shadow-card">
            <span className={`text-[15px] font-semibold ${w.active ? "text-text-primary" : "text-text-secondary line-through"}`}>{w.name}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => void (await setWorkerActiveAction(w.id, !w.active)))}
              className="min-h-11 rounded-icon border border-border px-3 text-sm font-semibold text-text-secondary hover:bg-page-bg"
            >
              {w.active ? "Тізімнен алу" : "Қайтару"}
            </button>
          </li>
        ))}
        {workers.length === 0 && <li className="text-sm text-text-secondary">Әзірге қызметкер жоқ.</li>}
      </ul>
    </div>
  );
}
