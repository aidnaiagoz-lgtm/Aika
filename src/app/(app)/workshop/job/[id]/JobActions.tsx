"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Play, RotateCcw } from "lucide-react";
import { finishJobAction, reopenJobAction, startJobAction, updateJobAction, type ActionResult } from "../../actions";
import { LEATHER_OWNERS, normDiffPct } from "@/lib/domain/workshop/calc";

function useCall() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const call = (p: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await p();
      setError(r.ok ? null : r.error);
      if (r.ok) onOk?.();
    });
  return { pending, error, setError, call };
}

const Err = ({ e }: { e: string | null }) => (e ? <p className="m-0 mt-2 rounded-icon bg-danger/10 px-3 py-2 text-sm text-danger">{e}</p> : null);

export function StartAction({ id, manager }: { id: string; manager: string | null }) {
  const { pending, error, call } = useCall();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => call(() => startJobAction(id))}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-accent text-base font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(108,92,246,0.6)] hover:bg-accent-hover disabled:opacity-60"
      >
        <Play size={18} /> {pending ? "Жіберілуде…" : "Тігуді бастау"}
      </button>
      <p className="m-0 text-center text-xs leading-relaxed text-text-secondary">
        Басқанда заказ «Тігіліп жатыр»-ға өтеді{manager ? `, ${manager}-ға хабар барады` : ""}
      </p>
      <Err e={error} />
    </div>
  );
}

export function DoneActions({
  id,
  status,
  missing,
  doneAt,
  handed,
}: {
  id: string;
  status: "IN_PROGRESS" | "DONE";
  missing: string[];
  doneAt: string | null;
  handed: boolean;
}) {
  const { pending, error, call } = useCall();
  if (status === "DONE") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-[14px] bg-[#e7f7ec] px-4 py-3 font-bold text-[#15803d]">
          <Check size={18} /> Дайын · {doneAt}
        </div>
        <p className="m-0 text-xs text-text-secondary">Менеджерге хабар барды. {handed ? "Клиентке берілді." : "Клиентке әлі берілмеген."}</p>
        {!handed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => call(() => reopenJobAction(id))}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-icon border border-border text-sm font-semibold text-text-secondary hover:bg-page-bg"
          >
            <RotateCcw size={15} /> Қате басылды — қайтару
          </button>
        )}
        <Err e={error} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => call(() => finishJobAction(id))}
        className={`flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] text-base font-extrabold text-white disabled:opacity-60 ${
          missing.length ? "bg-[#16a34a]/45" : "bg-[#16a34a] shadow-[0_8px_20px_-8px_rgba(22,163,74,0.6)] hover:bg-[#15803d]"
        }`}
      >
        <Check size={18} /> {pending ? "Жіберілуде…" : "Дайын"}
      </button>
      {missing.length > 0 ? (
        <p className="m-0 text-xs leading-relaxed text-text-secondary">
          Батырма басылуы үшін реестрді толтырыңыз: <b className="text-text-primary">{missing.join(", ")}</b>
        </p>
      ) : (
        <p className="m-0 text-center text-xs text-text-secondary">Басқанда менеджерге хабар барады</p>
      )}
      <Err e={error} />
    </div>
  );
}

export function LekalaBox({ id, note }: { id: string; note: string | null }) {
  const { pending, error, call } = useCall();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note ?? "");
  if (note && !open) {
    return (
      <div className="mt-3 rounded-[14px] border border-danger/30 bg-danger/5 px-3.5 py-3 text-sm">
        <div className="flex items-center gap-1.5 font-bold text-danger">
          <AlertTriangle size={15} /> {note}
        </div>
        <button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs font-semibold text-text-secondary underline">
          Өзгерту / алып тастау
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-icon border border-border text-sm font-bold text-text-primary hover:bg-page-bg"
      >
        <AlertTriangle size={15} /> Лекала жоқ / сұрақ бар
      </button>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-2">
      <input
        value={text}
        maxLength={60}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        placeholder="мыс. Лекала жоқ · переделка · возврат"
        className="min-h-11 rounded-icon border border-border bg-page-bg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => call(() => updateJobAction(id, { lekalaNote: text.trim() || null }), () => setOpen(false))}
          className="flex-1 rounded-icon bg-[#0b1a45] py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          Сақтау
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-icon border border-border px-4 text-sm font-semibold text-text-secondary">
          Болдырмау
        </button>
      </div>
      <Err e={error} />
    </div>
  );
}

export interface RegistryJob {
  id: string;
  done: boolean;
  leatherName: string | null;
  matName: string | null;
  leatherMeters: number | null;
  leatherOwner: string | null;
  matMeters: number | null;
  matOwner: string | null;
  norm: number | null;
  cutBy: string | null;
  joinBy: string | null;
  edgeBy: string | null;
  bottomBy: string | null;
}

const inputCls =
  "min-h-11 w-full rounded-icon border border-border bg-surface px-3 text-[15px] font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-page-bg disabled:text-text-secondary";
const lbl = "mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary";
const num = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

function MetersInput({ value, disabled, placeholder, onSave }: { value: number | null; disabled: boolean; placeholder: string; onSave: (n: number | null) => string | null }) {
  const [v, setV] = useState(num(value));
  return (
    <input
      inputMode="decimal"
      className={inputCls}
      value={v}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const t = v.trim().replace(",", ".");
        const n = t === "" ? null : Number(t);
        if (n !== null && Number.isNaN(n)) return;
        if (n !== value) {
          const err = onSave(n);
          if (err) setV(num(value));
        }
      }}
    />
  );
}

/** Цех реестр — Google «01. Цех реестр»-дің M-бағанынан бергі бөлігі (Бекзат толтырады, CEO 2026-11-17). */
export function RegistryForm({ job, workers }: { job: RegistryJob; workers: string[] }) {
  const { pending, error, setError, call } = useCall();
  const [leatherM, setLeatherM] = useState(job.leatherMeters);
  const save = (patch: Parameters<typeof updateJobAction>[1]) => call(() => updateJobAction(job.id, patch));
  const diff = normDiffPct(leatherM, job.norm);
  const owners = (cur: string | null) => (cur && !LEATHER_OWNERS.includes(cur) ? [cur, ...LEATHER_OWNERS] : LEATHER_OWNERS);
  const people = (cur: string | null) => (cur && !workers.includes(cur) ? [cur, ...workers] : workers);
  const dis = job.done || pending;

  const op = (label: string, field: "cutBy" | "joinBy" | "edgeBy" | "bottomBy") => (
    <label className="block">
      <span className={lbl}>{label}</span>
      <select className={inputCls} defaultValue={job[field] ?? ""} disabled={dis} onChange={(e) => save({ [field]: e.target.value || null })}>
        <option value="">— таңдаңыз</option>
        {people(job[field]).map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
    </label>
  );

  const group = "rounded-[14px] border border-border bg-page-bg/50 p-3.5";
  const gt = "mb-2.5 text-xs font-extrabold tracking-wide text-text-secondary";

  return (
    <section className={`rounded-card bg-surface p-5 shadow-card ${pending ? "opacity-80" : ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-extrabold text-text-primary">Цех реестр</h2>
        <span className="text-xs font-semibold text-text-secondary">{job.done ? "Дайын — өзгерту үшін «қайтару»" : "Әр өріс өзі сақталады"}</span>
      </div>
      <div className="flex flex-col gap-3">
        {job.leatherName && (
          <div className={group}>
            <div className={gt}>КОЖА</div>
            <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1.1fr]">
              <div>
                <span className={lbl}>Кожа вид</span>
                <div className={`${inputCls} flex items-center bg-page-bg`}>{job.leatherName}</div>
              </div>
              <div>
                <span className={lbl}>
                  Расход, метр
                  {diff != null && diff > 20 && <span className="rounded-[8px] bg-[#fff7e0] px-2 py-0.5 text-[11px] font-bold text-[#a16207]">нормадан +{diff}%</span>}
                </span>
                <MetersInput
                  value={job.leatherMeters}
                  disabled={dis}
                  placeholder={job.norm != null ? `норма ${num(job.norm)}` : "мыс. 1,75"}
                  onSave={(n) => {
                    if (n != null && (n < 0 || n > 50)) {
                      setError("Метр 0–50 аралығында болуы керек");
                      return "bad";
                    }
                    setLeatherM(n);
                    save({ leatherMeters: n });
                    return null;
                  }}
                />
                {job.norm != null && <div className="mt-1 text-[11px] text-text-secondary">норма {num(job.norm)} м</div>}
              </div>
              <label className="block">
                <span className={lbl}>Чья кожа</span>
                <select className={inputCls} defaultValue={job.leatherOwner ?? "Өзіміздікі"} disabled={dis} onChange={(e) => save({ leatherOwner: e.target.value })}>
                  {owners(job.leatherOwner).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {job.matName && (
          <div className={group}>
            <div className={gt}>СЪЁМНЫЙ ПОЛИК</div>
            <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1.1fr]">
              <div>
                <span className={lbl}>Вид</span>
                <div className={`${inputCls} flex items-center bg-page-bg`}>{job.matName}</div>
              </div>
              <div>
                <span className={lbl}>Расход, метр</span>
                <MetersInput
                  value={job.matMeters}
                  disabled={dis}
                  placeholder="мыс. 0,5"
                  onSave={(n) => {
                    if (n != null && (n < 0 || n > 50)) {
                      setError("Метр 0–50 аралығында болуы керек");
                      return "bad";
                    }
                    save({ matMeters: n });
                    return null;
                  }}
                />
              </div>
              <label className="block">
                <span className={lbl}>Чья</span>
                <select className={inputCls} defaultValue={job.matOwner ?? "Өзіміздікі"} disabled={dis} onChange={(e) => save({ matOwner: e.target.value })}>
                  {owners(job.matOwner).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className={group}>
          <div className={gt}>ЖҰМЫС · айлыққа есептеледі</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {op("Резка кожи", "cutBy")}
            {op("Стыковка", "joinBy")}
            {op("Окантовщик / крепления", "edgeBy")}
            {op("Дно", "bottomBy")}
          </div>
        </div>
      </div>
      <Err e={error} />
    </section>
  );
}
