"use client";

import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { removeUnpushedRowAction } from "./actions";

const money = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} ₸`;
const dm = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : "—");

type Row = { id: string; no: number; day: string | null; manager: string | null; car: string; product: string | null; sum: number };

/**
 * Сайтта жазылып, Google кестеге түспеген сатылымдар. Қазірше (CEO, 2026-11-21) рейтинг пен айналымда САНАЛМАЙДЫ —
 * тек Google-дағылар саналады. Тест болса — «Өшіру»; нақты болса — скрипт түзелген соң кестеге өзі түседі.
 */
export function UnpushedBox({ rows, error }: { rows: Row[]; error: string | null }) {
  const [list, setList] = useState(rows);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const validation = !!error && /validation|проверк|правил/i.test(error);
  if (list.length === 0) return msg ? <p className="m-0 rounded-card bg-[#e7f7ec] px-5 py-4 text-sm font-semibold text-[#15803d]">{msg}</p> : null;
  return (
    <div id="unpushed" className="rounded-card border border-[#fde68a] bg-[#fffbeb] p-5 text-sm text-text-primary">
      <div className="mb-1 flex items-center gap-2 font-bold text-[#b45309]">
        <TriangleAlert size={16} /> Google кестеге түспеген сатылым: {list.length}
      </div>
      Бұлар сайтта енгізілген, бірақ Google кестеде жоқ. Рейтинг пен айналымда <b>саналмайды</b> (тек Google-дағылар саналады).
      Тест болса — өшіріңіз; нақты болса — Google скрипті түзелген соң кестеге өзі түседі.
      <ul className="m-0 mt-3 flex list-none flex-col p-0">
        {list.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#fde68a] py-2">
            <span className="w-14 font-semibold text-text-secondary">{dm(r.day)}</span>
            <span className="min-w-0 flex-1">
              <b>{r.car || "көлік жазылмаған"}</b> · {r.product || "тауар жоқ"} · {money(r.sum)}
              {r.manager && <span className="text-text-secondary"> · {r.manager}</span>}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Өшіреміз бе: ${r.car} · ${r.product ?? ""} · ${money(r.sum)}?`)) return;
                start(async () => {
                  const res = await removeUnpushedRowAction(r.id);
                  if (!res.ok) return setMsg(res.error);
                  setList((l) => l.filter((x) => x.id !== r.id));
                  setMsg("✓ Өшірілді");
                });
              }}
              className="rounded-pill border border-[#e3e5eb] bg-white px-3 py-1 text-xs font-semibold text-danger disabled:opacity-60"
            >
              Өшіру
            </button>
          </li>
        ))}
      </ul>
      {error && <div className="mt-2 rounded-[10px] bg-white/70 px-3 py-2 font-mono text-xs text-text-secondary">Скрипт қатесі: {error}</div>}
      <div className="mt-2 text-xs text-text-secondary">
        {validation
          ? "Себебі: кестедегі ашылмалы тізімде (мыс. «Менеджер») бұл мән жоқ — тізімге қосыңыз."
          : "Нақты заказ кестеге түспесе: төмендегі «Сайттан Google кестеге» бөлімінде скриптті қайта көшіріп, Apps Script-ке қойып, «Новая версия» жасаңыз."}
      </div>
      {msg && <div className="mt-1 text-xs font-semibold">{msg}</div>}
    </div>
  );
}
