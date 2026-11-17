"use client";

import { useEffect, useState, useTransition } from "react";
import { markHandedAction } from "./flow-actions";

/** Цехта қанша уақыт тұр — минут сайын жаңарады; 2 сағаттан асса қызыл (CEO: бір заказ 1–2 сағатта тігілуі керек). */
export function Elapsed({ from }: { from: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  if (now == null) return <span className="text-text-secondary">—</span>;
  const min = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const text = d > 0 ? `${d} күн ${h} сағ` : h > 0 ? `${h} сағ ${m} мин` : `${m} мин`;
  return <span className={`tabular-nums ${min > 120 ? "font-bold text-danger" : "text-text-primary"}`}>{text}</span>;
}

export function HandedButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await markHandedAction(id);
            setError(r.ok ? null : r.error);
          })
        }
        className="rounded-icon border border-accent px-4 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
      >
        {pending ? "…" : "Берілді"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
