"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Play, RotateCcw } from "lucide-react";
import { reopenJobAction, startJobAction, type ActionResult } from "./actions";
import { JobCard, type ClientJob } from "./JobCard";
import { DragScroll } from "../orders/DragScroll";

/**
 * Цех тапсырмалары — компьютерде «Заказдар» сияқты кесте (CEO, 2026-11-16). Әр тапсырма — бір жол; «Ашу» басса
 * астында толық карточка ашылады (шеберлер, метр, «Дайын»). Телефонда — бұрынғы карточкалар (бет өзі шешеді).
 */

const dt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Asia/Almaty" });
const tm = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const clean = (s: string | null | undefined) => (s ?? "").replace(/^\d+\s*-\s*(Кожа|Жіп|Лента|Ева|Леска)\s*-\s*/i, "").trim();

const STATUS: Record<ClientJob["status"], { label: string; cls: string }> = {
  NEW: { label: "Жаңа", cls: "bg-[#fff4e0] text-[#b45309]" },
  IN_PROGRESS: { label: "Жасалып жатыр", cls: "bg-[#eef2ff] text-[#3b4b9c]" },
  DONE: { label: "Дайын", cls: "bg-[#e7f7ec] text-[#15803d]" },
  CANCELLED: { label: "Алынды", cls: "bg-page-bg text-text-secondary" },
};

const OPS: Array<{ key: "cutBy" | "joinBy" | "edgeBy" | "bottomBy"; short: string }> = [
  { key: "cutBy", short: "Резка" },
  { key: "joinBy", short: "Стык" },
  { key: "edgeBy", short: "Окант" },
  { key: "bottomBy", short: "Дно" },
];

// Күйі мен батырмалар — №-нен кейін бірден (кесте кең, оң жаққа айналдырмай-ақ көрінсін)
const HEAD = ["№", "Күйі", "", "Түсті", "Менеджер", "Көлік", "Тауар", "Кожа", "Стыковка жібі", "Лента", "Окантовка жібі", "Съёмный", "Карм.", "Операциялар"];

export function JobTable({ jobs, workers, highlight }: { jobs: ClientJob[]; workers: string[]; highlight?: string }) {
  const [open, setOpen] = useState<string | null>(highlight ?? null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const call = (p: Promise<ActionResult>) =>
    start(async () => {
      const r = await p;
      setError(r.ok ? null : r.error);
    });

  return (
    <div className={`flex flex-col gap-2 ${pending ? "opacity-70" : ""}`}>
      {error && <p className="m-0 rounded-icon bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <DragScroll className="overflow-auto rounded-card bg-surface shadow-card md:max-h-[calc(100dvh-300px)]">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs text-text-secondary">
              {HEAD.map((h, i) => (
                <th
                  key={i}
                  className="sticky -top-px z-10 whitespace-nowrap border border-border bg-page-bg px-3 py-2 font-semibold shadow-[0_1px_0_var(--color-border),0_-1px_0_var(--color-page-bg)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const isOpen = open === j.id;
              const opsDone = OPS.filter((o) => j[o.key]).length;
              const received = new Date(j.receivedAt);
              return (
                <Fragment key={j.id}>
                  <tr className={`align-top ${isOpen ? "bg-accent/5" : "hover:bg-page-bg/60"} ${highlight === j.id ? "ring-2 ring-inset ring-accent" : ""}`}>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5 font-bold tabular-nums">{j.orderNo}</td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5">
                      <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${STATUS[j.status].cls}`}>{STATUS[j.status].label}</span>
                      {j.status === "DONE" && j.doneAt && (
                        <div className="mt-1 text-xs text-text-secondary">
                          {dt.format(new Date(j.doneAt))} {tm.format(new Date(j.doneAt))}
                        </div>
                      )}
                      {j.lekalaNote && <div className="mt-1 max-w-[160px] text-xs font-semibold text-danger">{j.lekalaNote}</div>}
                    </td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5">
                      <div className="flex flex-col items-stretch gap-1.5">
                        {j.status === "NEW" && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => call(startJobAction(j.id))}
                            className="flex items-center justify-center gap-1.5 rounded-icon bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-hover"
                          >
                            <Play size={14} /> Бастадым
                          </button>
                        )}
                        {j.status === "DONE" && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => call(reopenJobAction(j.id))}
                            className="flex items-center justify-center gap-1.5 rounded-icon border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-page-bg"
                          >
                            <RotateCcw size={13} /> Қайтару
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : j.id)}
                          className="flex items-center justify-center gap-1 rounded-icon border border-accent/40 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/10"
                        >
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {isOpen ? "Жабу" : j.status === "IN_PROGRESS" ? "Ашу / Дайын" : "Ашу"}
                        </button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5">
                      <div className="text-text-secondary">{dt.format(received)}</div>
                      <div className="font-semibold tabular-nums">{tm.format(received)}</div>
                    </td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5 text-text-secondary">{j.manager ?? "—"}</td>
                    <td className="min-w-[140px] border border-border px-3 py-2.5 font-semibold">{j.car || "—"}</td>
                    <td className="min-w-[180px] border border-border px-3 py-2.5">{j.product || "—"}</td>
                    <td className="min-w-[150px] border border-border px-3 py-2.5">{clean(j.leatherType) || "—"}</td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5">{clean(j.leatherThread) || "—"}</td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5">{clean(j.leatherPiping) || "—"}</td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5">{clean(j.leatherPipingThread) || "—"}</td>
                    <td className="min-w-[110px] border border-border px-3 py-2.5">{clean(j.matType) || "—"}</td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5 text-center">{j.pocketsPairs ? `${j.pocketsPairs} жұп` : "—"}</td>
                    <td className="whitespace-nowrap border border-border px-3 py-2.5">
                      {j.status === "NEW" ? (
                        <span className="text-text-secondary">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="font-bold text-text-primary">
                            {opsDone}/{OPS.length}
                          </span>
                          {OPS.map((o) => (
                            <span key={o.key} className={j[o.key] ? "text-text-primary" : "text-text-secondary/60"}>
                              {o.short}: {j[o.key] ?? "—"}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={HEAD.length} className="border border-border bg-page-bg p-3">
                        {/* Кесте жанына айналдырылса да карточка көрінетін жерде тұрады */}
                        <div className="sticky left-0 max-w-3xl">
                          <JobCard job={j} workers={workers} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </DragScroll>
    </div>
  );
}
