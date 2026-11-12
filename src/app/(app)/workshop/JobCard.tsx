"use client";

import { useState, useTransition } from "react";
import { Check, Play, RotateCcw } from "lucide-react";
import { finishJobAction, reopenJobAction, startJobAction, updateJobAction, type ActionResult } from "./actions";
import { OPERATION_FIELD, OPERATION_LABEL, OPERATIONS, LEATHER_OWNERS, type Operation } from "@/lib/domain/workshop/calc";

export interface ClientJob {
  id: string;
  orderNo: string;
  status: "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  receivedAt: string;
  doneAt: string | null;
  manager: string | null;
  headline: string;
  leatherType: string | null;
  leatherThread: string | null;
  leatherPiping: string | null;
  matType: string | null;
  pocketsPairs: number | null;
  lekalaNote: string | null;
  leatherMeters: number | null;
  leatherOwner: string | null;
  norm: number | null;
  cutBy: string | null;
  joinBy: string | null;
  edgeBy: string | null;
  bottomBy: string | null;
}

const fmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const selectCls =
  "min-h-11 w-full rounded-icon border border-border bg-page-bg px-3 text-[15px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";

const STATUS: Record<ClientJob["status"], { label: string; cls: string }> = {
  NEW: { label: "Жаңа", cls: "bg-[#fff4e0] text-[#b45309]" },
  IN_PROGRESS: { label: "Жасалып жатыр", cls: "bg-[#eef2ff] text-[#3b4b9c]" },
  DONE: { label: "Дайын", cls: "bg-[#e7f7ec] text-[#15803d]" },
  CANCELLED: { label: "Алынып тасталды", cls: "bg-page-bg text-text-secondary" },
};

const clean = (s: string | null) => (s ?? "").replace(/^\d+\s*-\s*(Кожа|Жіп|Лента|Ева|Леска)\s*-\s*/i, "").trim();

export function JobCard({ job, workers, highlight }: { job: ClientJob; workers: string[]; highlight?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [meters, setMeters] = useState(job.leatherMeters == null ? "" : String(job.leatherMeters));

  const call = (p: Promise<ActionResult>) =>
    start(async () => {
      const r = await p;
      setError(r.ok ? null : r.error);
    });

  const done = job.status === "DONE";
  const opOptions = (current: string | null) => (current && !workers.includes(current) ? [current, ...workers] : workers);

  return (
    <article
      id={`job-${job.id}`}
      className={`flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card ${highlight ? "ring-2 ring-accent" : ""} ${pending ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-text-secondary">
          №{job.orderNo} · {fmt.format(new Date(job.receivedAt))}
          {job.manager ? ` · ${job.manager}` : ""}
        </span>
        <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${STATUS[job.status].cls}`}>{STATUS[job.status].label}</span>
      </div>

      <h3 className="m-0 text-[17px] font-bold leading-snug text-text-primary">{job.headline || "Көлік әлі жазылмаған"}</h3>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {job.leatherType && (
          <>
            <dt className="text-text-secondary">Кожа</dt>
            <dd className="m-0 font-medium">
              {clean(job.leatherType)}
              {job.leatherThread ? ` · жіп: ${clean(job.leatherThread)}` : ""}
              {job.leatherPiping ? ` · лента: ${clean(job.leatherPiping)}` : ""}
            </dd>
          </>
        )}
        {job.matType && (
          <>
            <dt className="text-text-secondary">Съёмный</dt>
            <dd className="m-0">{clean(job.matType)}</dd>
          </>
        )}
        {job.pocketsPairs != null && job.pocketsPairs > 0 && (
          <>
            <dt className="text-text-secondary">Кармашки</dt>
            <dd className="m-0">{job.pocketsPairs} жұп</dd>
          </>
        )}
        {job.lekalaNote && (
          <>
            <dt className="text-text-secondary">Лекала</dt>
            <dd className="m-0 font-semibold text-danger">{job.lekalaNote}</dd>
          </>
        )}
      </dl>

      {job.status !== "NEW" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OPERATIONS.map((op: Operation) => {
            const field = OPERATION_FIELD[op];
            const value = job[field];
            return (
              <label key={op} className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
                {OPERATION_LABEL[op]}
                <select
                  className={selectCls}
                  defaultValue={value ?? ""}
                  disabled={done || pending}
                  onChange={(e) => call(updateJobAction(job.id, { [field]: e.target.value || null }))}
                >
                  <option value="">—</option>
                  {opOptions(value).map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
            Кожа расход, метр
            <input
              inputMode="decimal"
              className={selectCls}
              value={meters}
              placeholder={job.norm != null ? `норма ${String(job.norm).replace(".", ",")}` : "мыс. 1,75"}
              disabled={done || pending}
              onChange={(e) => setMeters(e.target.value)}
              onBlur={() => {
                const v = meters.trim().replace(",", ".");
                const n = v === "" ? null : Number(v);
                if (n !== null && Number.isNaN(n)) return setError("Метрді сан етіп жазыңыз, мыс. 1,75");
                if (n !== job.leatherMeters) call(updateJobAction(job.id, { leatherMeters: n }));
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
            Чья кожа
            <select
              className={selectCls}
              defaultValue={job.leatherOwner ?? "Өзіміздікі"}
              disabled={done || pending}
              onChange={(e) => call(updateJobAction(job.id, { leatherOwner: e.target.value }))}
            >
              {LEATHER_OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && <p className="m-0 rounded-icon bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {job.status === "NEW" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => call(startJobAction(job.id))}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-icon bg-accent px-4 text-[15px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            <Play size={18} /> Бастадым
          </button>
        )}
        {job.status === "IN_PROGRESS" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => call(finishJobAction(job.id))}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-icon bg-[#16a34a] px-4 text-[15px] font-bold text-white hover:bg-[#15803d] disabled:opacity-60"
          >
            <Check size={18} /> Дайын
          </button>
        )}
        {done && (
          <>
            <span className="flex min-h-11 items-center text-sm text-text-secondary">
              Дайын: {job.doneAt ? fmt.format(new Date(job.doneAt)) : "—"}
              {job.leatherMeters != null ? ` · кожа ${String(job.leatherMeters).replace(".", ",")} м` : ""}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => call(reopenJobAction(job.id))}
              className="ml-auto flex min-h-11 items-center gap-1.5 rounded-icon border border-border px-3 text-sm font-semibold text-text-secondary hover:bg-page-bg"
            >
              <RotateCcw size={15} /> Қайтару
            </button>
          </>
        )}
      </div>
    </article>
  );
}
