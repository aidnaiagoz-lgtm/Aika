"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronRight, Play } from "lucide-react";
import { startJobAction } from "./actions";
import { Elapsed } from "../orders/flow-ui";
import { DragScroll } from "../orders/DragScroll";

export type ListView = "incoming" | "sewing" | "ready";

export interface ListJob {
  id: string;
  orderNo: string;
  status: "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  receivedAt: string;
  startedAt: string | null;
  doneAt: string | null;
  handedAt: string | null;
  manager: string | null;
  car: string;
  product: string | null;
  leather: string | null;
  leatherMeters: number | null;
  lekalaNote: string | null;
  workers: { cut: string | null; join: string | null; edge: string | null; bottom: string | null };
}

const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Asia/Almaty" });
const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const almatyDay = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

/** «Бүгін 11:40» / «Кеше 17:30» / «14.11 09:10» */
function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = almatyDay(new Date());
  const yest = almatyDay(new Date(Date.now() - 86400_000));
  const k = almatyDay(d);
  return `${k === today ? "Бүгін" : k === yest ? "Кеше" : day.format(d)} ${time.format(d)}`;
}

function duration(from: string | null, to: string | null) {
  if (!from || !to) return "—";
  const min = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} сағ ${String(min % 60).padStart(2, "0")} мин` : `${min} мин`;
}

const meters = (n: number | null) => (n == null ? "—" : `${String(n).replace(".", ",")} м`);
const OPS = [
  ["cut", "Резка"],
  ["join", "Стык"],
  ["edge", "Окант"],
  ["bottom", "Дно"],
] as const;

function StartButton({ id, big }: { id: string; big?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startJobAction(id);
            setError(r.ok ? null : r.error);
          })
        }
        className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-icon bg-accent font-bold text-white hover:bg-accent-hover disabled:opacity-60 ${
          big ? "min-h-12 px-4 text-[15px]" : "px-3 py-2 text-xs"
        }`}
      >
        <Play size={big ? 17 : 13} /> {pending ? "…" : "Тігуді бастау"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

function ReadyLink({ id, big }: { id: string; big?: boolean }) {
  return (
    <Link
      href={`/workshop/job/${id}`}
      className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-icon bg-[#16a34a] font-bold text-white hover:bg-[#15803d] ${
        big ? "min-h-12 px-4 text-[15px]" : "px-3 py-2 text-xs"
      }`}
    >
      <Check size={big ? 17 : 13} /> Дайын
    </Link>
  );
}

function ReadyState({ j }: { j: ListJob }) {
  return j.handedAt ? (
    <span className="whitespace-nowrap rounded-pill bg-page-bg px-2.5 py-1 text-xs font-semibold text-text-secondary">✓ Берілді · {when(j.handedAt)}</span>
  ) : (
    <span className="whitespace-nowrap rounded-pill bg-[#e7f7ec] px-2.5 py-1 text-xs font-semibold text-[#15803d]">Клиентке берілмеген</span>
  );
}

function Ops({ j }: { j: ListJob }) {
  return (
    <div className="flex flex-col text-xs leading-5">
      {OPS.map(([k, label]) => (
        <span key={k} className={`whitespace-nowrap ${j.workers[k] ? "text-text-primary" : "text-text-secondary/50"}`}>
          {label}: {j.workers[k] ?? "—"}
        </span>
      ))}
    </div>
  );
}

const th = "sticky -top-px z-10 whitespace-nowrap border-b border-border bg-page-bg px-4 py-2.5 text-left text-xs font-semibold text-text-secondary";
const td = "border-b border-border/60 px-4 py-3 align-middle";

export function JobList({ list, jobs }: { list: ListView; jobs: ListJob[] }) {
  const head =
    list === "incoming"
      ? ["№", "Түсті", "Менеджер", "Көлік", "Тауар", "Кожа", "Күтіп тұр", ""]
      : list === "sewing"
        ? ["№", "Басталды", "Өтті", "Менеджер", "Көлік", "Тауар", "Кожа", "Шеберлер", ""]
        : ["№", "Дайын болды", "Тігілді", "Менеджер", "Көлік", "Тауар", "Кожа, м", "Шеберлер", "Күйі"];

  return (
    <>
      {/* Компьютер — кесте */}
      <DragScroll className="hidden overflow-auto rounded-card bg-surface shadow-card md:block md:max-h-[calc(100dvh-260px)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-page-bg/60">
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/workshop/job/${j.id}`} className="font-bold tabular-nums text-accent underline-offset-2 hover:underline">
                    {j.orderNo}
                  </Link>
                  {j.lekalaNote && <div className="mt-0.5 max-w-[140px] text-xs font-semibold text-danger">⚠ {j.lekalaNote}</div>}
                </td>
                {list === "incoming" && <td className={`${td} whitespace-nowrap tabular-nums`}>{when(j.receivedAt)}</td>}
                {list === "sewing" && (
                  <>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{when(j.startedAt)}</td>
                    <td className={`${td} whitespace-nowrap`}>{j.startedAt ? <Elapsed from={j.startedAt} /> : "—"}</td>
                  </>
                )}
                {list === "ready" && (
                  <>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{when(j.doneAt)}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{duration(j.startedAt, j.doneAt)}</td>
                  </>
                )}
                <td className={`${td} whitespace-nowrap text-text-secondary`}>{j.manager ?? "—"}</td>
                <td className={`${td} min-w-[160px] font-semibold`}>{j.car || "—"}</td>
                <td className={`${td} min-w-[170px]`}>{j.product ?? "—"}</td>
                {list === "ready" ? (
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{meters(j.leatherMeters)}</td>
                ) : (
                  <td className={`${td} min-w-[140px]`}>{j.leather ?? "—"}</td>
                )}
                {list === "incoming" && (
                  <>
                    <td className={`${td} whitespace-nowrap`}>
                      <Elapsed from={j.receivedAt} />
                    </td>
                    <td className={td}>
                      <StartButton id={j.id} />
                    </td>
                  </>
                )}
                {list === "sewing" && (
                  <>
                    <td className={td}>
                      <Ops j={j} />
                    </td>
                    <td className={td}>
                      <ReadyLink id={j.id} />
                    </td>
                  </>
                )}
                {list === "ready" && (
                  <>
                    <td className={td}>
                      <Ops j={j} />
                    </td>
                    <td className={td}>
                      <ReadyState j={j} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </DragScroll>

      {/* Телефон — карточкалар */}
      <div className="flex flex-col gap-3 md:hidden">
        {jobs.map((j) => (
          <article key={j.id} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
            <Link href={`/workshop/job/${j.id}`} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-bold text-accent">№{j.orderNo}</span>
                <span className="flex items-center gap-1 text-text-secondary">
                  {list === "incoming" ? when(j.receivedAt) : list === "sewing" ? when(j.startedAt) : when(j.doneAt)}
                  <ChevronRight size={16} />
                </span>
              </div>
              <div className="text-[16px] font-bold leading-snug text-text-primary">{j.car || "Көлік жазылмаған"}</div>
              <div className="text-sm text-text-secondary">{[j.product, j.leather, j.manager].filter(Boolean).join(" · ")}</div>
              {j.lekalaNote && <div className="text-sm font-semibold text-danger">⚠ {j.lekalaNote}</div>}
            </Link>
            {list === "incoming" && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  Күтіп тұр: <Elapsed from={j.receivedAt} />
                </span>
                <div className="ml-auto">
                  <StartButton id={j.id} />
                </div>
              </div>
            )}
            {list === "sewing" && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">Өтті: {j.startedAt ? <Elapsed from={j.startedAt} /> : "—"}</span>
                <div className="ml-auto">
                  <ReadyLink id={j.id} />
                </div>
              </div>
            )}
            {list === "ready" && (
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                {meters(j.leatherMeters)} · {duration(j.startedAt, j.doneAt)}
                <div className="ml-auto">
                  <ReadyState j={j} />
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
