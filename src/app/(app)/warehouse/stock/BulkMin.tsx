"use client";

import { useState, useTransition } from "react";
import type { MaterialCategory } from "@prisma/client";
import { SlidersHorizontal, X } from "lucide-react";
import { parseQty, fmtQty } from "@/lib/domain/warehouse/stock-calc";
import type { Locale } from "@/lib/i18n";
import { setMinStockBulkAction } from "../actions";
import { WH } from "../t";

const inputCls = "min-h-11 w-full rounded-icon border border-border bg-surface px-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-accent/30";

/** «Минимумды бірден қою»: санат + сан → сол санаттың барлық материалына (CEO, 2026-11-21). */
export function BulkMin({ locale, categories, current }: { locale: Locale; categories: MaterialCategory[]; current?: MaterialCategory }) {
  const T = WH[locale];
  const t = T.bulk;
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<MaterialCategory | "ALL">(current ?? categories[0] ?? "ALL");
  const [value, setValue] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-pill bg-surface px-4 py-2 text-sm font-semibold text-text-primary shadow-card hover:bg-page-bg"
      >
        <SlidersHorizontal size={15} /> {t.open}
        {msg?.ok && <span className="ml-1 text-xs font-semibold text-[#15803d]">{msg.text}</span>}
      </button>
    );
  }

  const apply = () => {
    const n = value.trim() === "" ? null : parseQty(value);
    if (value.trim() !== "" && (n == null || n < 0)) return setMsg({ ok: false, text: t.badMin });
    const catName = cat === "ALL" ? t.allCats : T.category[cat];
    const q = n == null ? t.confirmClear(catName, onlyEmpty) : t.confirmSet(`${fmtQty(n)}`, catName, onlyEmpty);
    if (!window.confirm(q)) return;
    start(async () => {
      const r = await setMinStockBulkAction({ category: cat, minStock: n, onlyEmpty });
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: t.done(r.count) });
      setOpen(false);
      setValue("");
    });
  };

  return (
    <div className={`flex w-full flex-col gap-3 rounded-card bg-surface p-4 shadow-card ${pending ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-base font-bold text-text-primary">{t.title}</h2>
        <button type="button" aria-label={t.cancel} onClick={() => setOpen(false)} className="rounded-full p-1 text-text-secondary hover:bg-page-bg">
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-text-secondary">{t.category}</span>
          <select value={cat} onChange={(e) => setCat(e.target.value as MaterialCategory | "ALL")} className={inputCls}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {T.category[c]}
              </option>
            ))}
            <option value="ALL">{t.allCats}</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-text-secondary">{t.value}</span>
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t.valuePh} className={inputCls} />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={apply}
          className="min-h-11 rounded-pill bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {t.apply}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent,#6c5cf6)]" />
        {t.onlyEmpty}
      </label>
      <p className="m-0 text-xs text-text-secondary">{t.hint}</p>
      {msg && !msg.ok && <p className="m-0 text-sm font-semibold text-danger">{msg.text}</p>}
    </div>
  );
}
