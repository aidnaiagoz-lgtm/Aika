"use client";

import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { removeDuplicatesAction } from "./actions";

const money = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} ₸`;

/** Google-дан екі рет көшкен жолдар: саны мен артық саналған сома + «Тазалау» (тек CEO басады). */
export function DuplicatesBox({ extraRows, extraSum, sample }: { extraRows: number; extraSum: number; sample: number[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (msg?.ok) return <p className="m-0 rounded-card bg-[#e7f7ec] px-5 py-4 text-sm font-semibold text-[#15803d]">{msg.text}</p>;
  return (
    <div id="dupes" className="flex flex-col gap-3 rounded-card border border-[#fde68a] bg-[#fffbeb] p-5 md:flex-row md:items-center">
      <div className="flex-1 text-sm text-text-primary">
        <div className="mb-1 flex items-center gap-2 font-bold text-[#b45309]">
          <TriangleAlert size={16} /> Қосарланған жолдар: {extraRows}
        </div>
        Google кестесінен сайтқа көшкенде {extraRows} жол екі рет жазылып қалған — айналым мен рейтингте <b>{money(extraSum)}</b> артық саналып тұр.
        Мысалы: №{sample.slice(0, 8).join(", №")}. «Тазалау» басылғанда әр жолдың бір көшірмесі қалады, артығы өшеді (заказ, касса, цех байланыстары
        қалатын жолға көшеді). Себебі түзетілді — енді қайталанбайды.
        {msg && !msg.ok && <div className="mt-1 font-semibold text-danger">{msg.text}</div>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`${extraRows} қосарланған жолды тазалаймыз ба? (Әр жолдың бір көшірмесі қалады)`)) return;
          start(async () => {
            const r = await removeDuplicatesAction();
            setMsg(r.ok ? { ok: true, text: `✓ Тазаланды: ${r.removed} артық жол өшірілді. Айналым енді Google кестесімен бірдей.` } : { ok: false, text: r.error });
          });
        }}
        className="min-h-11 rounded-pill bg-[#0b1a45] px-5 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Тазалануда…" : "Тазалау"}
      </button>
    </div>
  );
}
