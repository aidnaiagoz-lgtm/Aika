"use client";

import { useState, useTransition } from "react";
import { activateWorkshopAction } from "./actions";

export function ActivateButton() {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="min-h-12 self-start rounded-pill bg-[#1f4fe0] px-6 text-[15px] font-bold text-white hover:bg-[#1a43b8]"
      >
        Цехты іске қосу
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-icon border border-border bg-page-bg p-4">
      <p className="m-0 text-sm text-text-primary">Бүгіннен бастап «Цех ✓» сатылымдар цехқа тапсырма болып түседі. Іске қосамыз ба?</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await activateWorkshopAction();
              if (!r.ok) setError(r.error);
            })
          }
          className="min-h-11 rounded-pill bg-[#16a34a] px-5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Қосылуда..." : "Иә, іске қосу"}
        </button>
        <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-pill border border-border px-5 text-sm font-semibold">
          Жоқ
        </button>
      </div>
      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </div>
  );
}
