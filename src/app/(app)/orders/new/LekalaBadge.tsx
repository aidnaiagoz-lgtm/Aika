"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CircleHelp, Loader2, TriangleAlert } from "lucide-react";
import { lookupLekalaAction, requestLekalaAction } from "../../lekala/actions";
import type { LekalaLookup } from "@/lib/domain/lekala";

const tm = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const pill = "inline-flex items-center gap-1.5 rounded-[12px] px-3 py-2 text-[13px] font-semibold";

/**
 * Жаңа заказ: марка+модель жазылғанда — лекала бар-жоғы (цех тарихы / цех белгісі). Жоқ болса — «Цехтан сұрау» (Бекзатқа хабар),
 * жауап күтілгенде 20 секунд сайын тексеріледі.
 */
export function LekalaBadge({ make, model, year }: { make: string; model: string; year: string }) {
  const [data, setData] = useState<LekalaLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const y = /^\d{4}$/.test(year.trim()) ? Number(year.trim()) : null;
  const ready = make.trim().length > 1 && model.trim().length > 0;

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await lookupLekalaAction(make, model, y).catch(() => null);
      if (alive) {
        setData(r);
        setLoading(false);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [make, model, y, ready]);

  // Цехтан жауап күтілгенде — 20 секунд сайын жаңарту
  const waiting = data?.verdict.status === "asked";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      const r = await lookupLekalaAction(make, model, y).catch(() => null);
      if (r) setData(r);
    }, 20_000);
    return () => clearInterval(t);
  }, [waiting, make, model, y]);

  if (!ready) return null;
  if (loading && !data)
    return (
      <span className={`${pill} bg-page-bg text-text-secondary`}>
        <Loader2 size={14} className="animate-spin" /> Лекала тексерілуде…
      </span>
    );
  if (!data) return null;
  const v = data.verdict;

  const ask = (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await requestLekalaAction(make, model, y);
          if (!r.ok) return setError(r.error);
          setError(null);
          setData(r.data);
        })
      }
      className="rounded-[12px] bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
    >
      {pending ? "Жіберілуде…" : "Цехтан сұрау"}
    </button>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {v.status === "have" && (
          <span className={`${pill} bg-[#e7f7ec] text-[#15803d]`}>
            <Check size={15} strokeWidth={2.5} />
            Лекала бар
            {v.source === "history" && v.count > 0 && (
              <span className="font-normal">
                · бұрын {v.count} рет тіктік{v.years ? ` (${v.years})` : ""}
              </span>
            )}
            {v.source === "mark" && <span className="font-normal">· {v.by ?? "цех"} растады</span>}
          </span>
        )}
        {v.status === "check_year" && (
          <>
            <span className={`${pill} bg-[#fff4e0] text-[#b45309]`}>
              <TriangleAlert size={15} /> Бұрын тек {v.years} жылдарға тіктік — жылын цехтан сұраңыз
            </span>
            {ask}
          </>
        )}
        {v.status === "none" && (
          <>
            <span className={`${pill} bg-[#fff4e0] text-[#b45309]`}>
              <TriangleAlert size={15} /> Лекала жоқ — бұл көлікке әлі тікпедік
            </span>
            {ask}
          </>
        )}
        {v.status === "asked" && (
          <span className={`${pill} bg-accent/10 text-accent`}>
            <CircleHelp size={15} />
            {data.request?.status === "SEARCHING"
              ? `${data.request.answeredBy ?? "Цех"} іздеп жатыр`
              : `Цехтан сұралды${data.request ? ` · ${tm.format(new Date(data.request.at))}` : ""} — жауап күтілуде`}
          </span>
        )}
      </div>
      {data.products.length > 0 && (v.status === "have" || v.status === "check_year") && (
        <div className="mt-1 max-w-[560px] rounded-[12px] border border-border bg-surface px-3.5 py-2.5">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
            {data.make} {data.model} — бұрын тіккендер
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {data.products.map((p) => (
              <li
                key={p.label}
                className={`flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-[13px] last:border-b-0 ${p.fitsYear === false ? "text-text-secondary" : "text-text-primary"}`}
              >
                <span className="font-semibold">
                  {p.fitsYear === true && <Check size={13} strokeWidth={3} className="mr-1 inline text-[#15803d]" />}
                  {p.label}
                </span>
                <span className="shrink-0 text-xs text-text-secondary">
                  {p.count} рет{p.years ? ` · ${p.years}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {data.year && <div className="mt-1 text-[11px] text-text-secondary">✓ — {data.year} жылға (±1) тігілгені</div>}
        </div>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
