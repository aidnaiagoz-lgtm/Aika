"use client";

import { useState, useTransition } from "react";
import { setRateAction } from "../actions";
import { OPERATIONS, type Operation } from "@/lib/domain/workshop/calc";

export function RateEditor({ rates, labels, canEdit }: { rates: Record<Operation, number>; labels: Record<Operation, string>; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {OPERATIONS.map((op) => (
          <label key={op} className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
            {labels[op]}
            {canEdit ? (
              <input
                inputMode="numeric"
                defaultValue={rates[op]}
                disabled={pending}
                className="min-h-11 rounded-icon border border-border bg-page-bg px-3 text-[15px] text-text-primary"
                onBlur={(e) => {
                  const n = Number(e.target.value.replace(/\s/g, ""));
                  if (!Number.isFinite(n) || n === rates[op]) return;
                  start(async () => {
                    const r = await setRateAction(op, n);
                    setMsg(r.ok ? "Сақталды ✓" : r.error);
                  });
                }}
              />
            ) : (
              <span className="text-[15px] font-bold text-text-primary">{new Intl.NumberFormat("ru-RU").format(rates[op])} ₸</span>
            )}
          </label>
        ))}
      </div>
      {msg && <p className="m-0 text-sm text-text-secondary">{msg}</p>}
    </div>
  );
}
