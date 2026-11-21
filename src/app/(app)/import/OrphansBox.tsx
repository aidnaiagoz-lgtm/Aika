"use client";

import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { removeSheetOrphansAction } from "./actions";

const money = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} ₸`;
const day = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);

/** Google кестеде өшірілген, бірақ сайтта қалған сатылымдар + «Сайттан да өшіру» (тек CEO/РОП басады). */
export function OrphansBox({ count, sum, nos, managers, days }: { count: number; sum: number; nos: number[]; managers: string[]; days: string[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (msg?.ok) return <p className="m-0 rounded-card bg-[#e7f7ec] px-5 py-4 text-sm font-semibold text-[#15803d]">{msg.text}</p>;
  return (
    <div id="orphans" className="flex flex-col gap-3 rounded-card border border-[#fde68a] bg-[#fffbeb] p-5 md:flex-row md:items-center">
      <div className="flex-1 text-sm text-text-primary">
        <div className="mb-1 flex items-center gap-2 font-bold text-[#b45309]">
          <TriangleAlert size={16} /> Google-да өшірілген, сайтта қалған сатылым: {count}
        </div>
        №{nos.slice(0, 10).join(", №")} ({days.map(day).join(", ")}{managers.length ? ` · ${managers.join(", ")}` : ""}) — сайтта енгізіліп, Google кестеге жіберілген,
        кейін кестеден өшірілген. Сайтта әлі тұр, сондықтан айналым мен рейтингте <b>{money(sum)}</b> артық саналып жатыр. Тест заказ болса немесе
        кестеден әдейі өшірсеңіз — «Сайттан да өшіру» басыңыз. Қате өшірілсе — кестеге қайта жазыңыз, сайтқа өзі түседі.
        {msg && !msg.ok && <div className="mt-1 font-semibold text-danger">{msg.text}</div>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`${count} сатылымды (№${nos.join(", №")}) сайттан өшіреміз бе?`)) return;
          start(async () => {
            const r = await removeSheetOrphansAction();
            setMsg(r.ok ? { ok: true, text: `✓ Сайттан өшірілді: ${r.removed} жол. Айналым енді Google кестесімен бірдей.` } : { ok: false, text: r.error });
          });
        }}
        className="min-h-11 shrink-0 rounded-pill bg-[#0b1a45] px-5 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Өшірілуде…" : "Сайттан да өшіру"}
      </button>
    </div>
  );
}
