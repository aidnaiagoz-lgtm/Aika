"use client";

import { useState, useTransition } from "react";
import { updateMaterialSettingsAction } from "../../actions";
import { fmtQty, parseQty } from "@/lib/domain/warehouse/stock-calc";
import type { Locale } from "@/lib/i18n";
import { WH } from "../../t";

const inputCls = "min-h-11 w-full rounded-icon border border-border bg-surface px-3.5 text-[15px] tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/30";

/** Минимум (осыған жетсе не төмен — «Аз қалды») және бағасы — өріс шыққанда өзі сақталады. */
export function MaterialSettings({
  locale,
  id,
  unit,
  min,
  price,
  roll,
  defaultRoll,
  leadDays,
}: {
  locale: Locale;
  id: string;
  unit: string;
  min: number | null;
  price: number;
  /** Материалдың өз рулон ұзындығы (бос — санаттың әдепкісі) */
  roll: number | null;
  defaultRoll: number | null;
  /** Жеткізу мерзімі, күн (бос — 45) */
  leadDays: number | null;
}) {
  const t = WH[locale].set;
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [minV, setMinV] = useState(min == null ? "" : String(min).replace(".", ","));
  const [priceV, setPriceV] = useState(price > 0 ? String(price).replace(".", ",") : "");
  const [rollV, setRollV] = useState(roll == null ? "" : String(roll).replace(".", ","));
  const [leadV, setLeadV] = useState(leadDays == null ? "" : String(leadDays));

  const save = (patch: { minStock?: number | null; price?: number | null; rollLength?: number | null; leadDays?: number | null }) =>
    start(async () => {
      const r = await updateMaterialSettingsAction(id, patch);
      setMsg(r.ok ? { ok: true, text: WH[locale].saved } : { ok: false, text: r.error });
    });

  return (
    <aside className={`flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card ${pending ? "opacity-70" : ""}`}>
      <h2 className="m-0 text-base font-bold">{t.title}</h2>
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-text-secondary">{t.min(unit)}</span>
        <input
          inputMode="decimal"
          value={minV}
          placeholder={t.minPh}
          onChange={(e) => setMinV(e.target.value)}
          onBlur={() => {
            const n = parseQty(minV);
            if (n !== min) save({ minStock: n });
          }}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-text-secondary">{t.minHint}{min != null ? t.minNow(fmtQty(min), unit) : ""}</span>
      </label>
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-text-secondary">{t.lead}</span>
        <input
          inputMode="numeric"
          value={leadV}
          placeholder={t.leadPh}
          onChange={(e) => setLeadV(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => {
            const n = leadV.trim() === "" ? null : Number(leadV);
            if (n !== leadDays) save({ leadDays: n });
          }}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-text-secondary">{t.leadHint}</span>
      </label>
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-text-secondary">{t.roll(unit)}</span>
        <input
          inputMode="decimal"
          value={rollV}
          placeholder={defaultRoll != null ? t.rollPhDefault(String(defaultRoll).replace(".", ",")) : t.rollPh}
          onChange={(e) => setRollV(e.target.value)}
          onBlur={() => {
            const n = parseQty(rollV);
            if (n !== roll) save({ rollLength: n });
          }}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-text-secondary">
          {defaultRoll != null
            ? t.rollHintDefault(String(defaultRoll).replace(".", ","), unit)
            : t.rollHint}
        </span>
      </label>
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-text-secondary">{t.price(unit)}</span>
        <input
          inputMode="decimal"
          value={priceV}
          placeholder={t.pricePh}
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
