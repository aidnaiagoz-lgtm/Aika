"use client";

import { useState, useTransition } from "react";
import { updateMaterialSettingsAction } from "../../actions";
import { fmtQty, parseQty } from "@/lib/domain/warehouse/stock-calc";

const inputCls = "min-h-11 w-full rounded-icon border border-border bg-surface px-3.5 text-[15px] tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/30";

/** Минимум (одан төмен — «Аз қалды») және бағасы — өріс шыққанда өзі сақталады. */
export function MaterialSettings({ id, unit, min, price }: { id: string; unit: string; min: number | null; price: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [minV, setMinV] = useState(min == null ? "" : String(min).replace(".", ","));
  const [priceV, setPriceV] = useState(price > 0 ? String(price).replace(".", ",") : "");

  const save = (patch: { minStock?: number | null; price?: number | null }) =>
    start(async () => {
      const r = await updateMaterialSettingsAction(id, patch);
      setMsg(r.ok ? { ok: true, text: "Сақталды" } : { ok: false, text: r.error });
    });

  return (
    <aside className={`flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card ${pending ? "opacity-70" : ""}`}>
      <h2 className="m-0 text-base font-bold">Баптау</h2>
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Минимум қалдық, {unit}</span>
        <input
          inputMode="decimal"
          value={minV}
          placeholder="мыс. 30"
          onChange={(e) => setMinV(e.target.value)}
          onBlur={() => {
            const n = parseQty(minV);
            if (n !== min) save({ minStock: n });
          }}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-text-secondary">Қалдық осыдан төмен түссе — «Аз қалды» болады{min != null ? ` (қазір ${fmtQty(min)} ${unit})` : ""}</span>
      </label>
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Бағасы, 1 {unit} үшін (₸)</span>
        <input
          inputMode="decimal"
          value={priceV}
          placeholder="соңғы кірістен өзі қойылады"
          onChange={(e) => setPriceV(e.target.value)}
          onBlur={() => {
            const n = parseQty(priceV);
            if ((n ?? 0) !== price) save({ price: n });
          }}
          className={inputCls}
        />
      </label>
      {msg && <p className={`m-0 text-sm font-semibold ${msg.ok ? "text-[#15803d]" : "text-danger"}`}>{msg.text}</p>}
    </aside>
  );
}
