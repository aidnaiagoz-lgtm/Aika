"use client";

import { useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle2, KeyRound, Copy, Printer, AlertTriangle } from "lucide-react";
import { ensureManagersAction, importChunkAction, finishImportAction } from "./actions";

type Cell = string | number | boolean | null;
type Parsed = {
  rows: Cell[][];
  from: string;
  to: string;
  activeManagers: Array<{ name: string; rows: number }>;
};
type Cred = { fullName: string; login: string; tempPassword?: string };

const CHUNK = 400;
const SHEET = "продажи";

function toCell(v: unknown): Cell {
  if (v instanceof Date) return v.toISOString();
  if (v === undefined) return null;
  return v as Cell;
}

export function ImportClient() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<"idle" | "parsing" | "ready" | "running" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Cred[]>([]);
  const [existing, setExisting] = useState<Cred[]>([]);
  const [copied, setCopied] = useState(false);
  const [blockDemo, setBlockDemo] = useState(true);

  async function onFile(file: File) {
    setError(null);
    setStage("parsing");
    setFileName(file.name);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const data = (await readSheet(file, SHEET)) as unknown[][];
      const rows = data.slice(1).filter((r) => r[3] instanceof Date && typeof r[0] === "number");
      if (rows.length === 0) throw new Error(`«${SHEET}» парағында күні бар жол табылмады`);
      const dates = rows.map((r) => (r[3] as Date).toISOString().slice(0, 10)).sort();
      const to = dates[dates.length - 1];
      const since = new Date(new Date(to).getTime() - 30 * 86400000).toISOString().slice(0, 10);
      const counter = new Map<string, number>();
      for (const r of rows) {
        const d = (r[3] as Date).toISOString().slice(0, 10);
        const m = typeof r[4] === "string" ? r[4].trim() : "";
        if (d >= since && m) counter.set(m, (counter.get(m) ?? 0) + 1);
      }
      const activeManagers = [...counter.entries()].map(([name, n]) => ({ name, rows: n })).sort((a, b) => b.rows - a.rows);
      setParsed({ rows: rows.map((r) => r.slice(0, 45).map(toCell)), from: dates[0], to, activeManagers });
      setSelected(Object.fromEntries(activeManagers.map((m) => [m.name, true])));
      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Файлды оқу мүмкін болмады");
      setStage("idle");
    }
  }

  async function run() {
    if (!parsed) return;
    setError(null);
    setStage("running");
    const names = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    const acc = await ensureManagersAction(names, blockDemo);
    if (!acc.ok) {
      setError(acc.error);
      setStage("ready");
      return;
    }
    setCreated(acc.created);
    setExisting(acc.existing);

    const total = parsed.rows.length;
    setProgress({ done: 0, total });
    for (let i = 0; i < total; i += CHUNK) {
      const res = await importChunkAction(parsed.rows.slice(i, i + CHUNK));
      if (!res.ok) {
        setError(`${i + 1}–${Math.min(i + CHUNK, total)} жолдарда қате: ${res.error}`);
        setStage("ready");
        return;
      }
      setProgress({ done: Math.min(i + CHUNK, total), total });
    }
    await finishImportAction({ rows: total, from: parsed.from, to: parsed.to, managers: names });
    setStage("done");
  }

  const credText = created.map((c) => `${c.fullName}\tлогин: ${c.login}\tуақытша пароль: ${c.tempPassword}`).join("\n");
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {stage !== "done" && (
        <label
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-[20px] border-2 border-dashed px-6 py-10 text-center transition-colors ${
            stage === "parsing" ? "border-[#1f4fd8] bg-[#f3f6ff]" : "border-border bg-surface hover:border-[#1f4fd8]"
          }`}
        >
          <FileSpreadsheet size={36} className="text-[#1f4fd8]" strokeWidth={1.6} />
          <div className="text-base font-semibold text-text-primary">
            {stage === "parsing" ? "Файл оқылуда…" : fileName ?? "Excel файлын таңдаңыз (.xlsx)"}
          </div>
          <div className="text-sm text-text-secondary">«{SHEET}» парағы оқылады · файл серверге жүктелмейді, браузерде өңделеді</div>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            disabled={stage === "parsing" || stage === "running"}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {parsed && stage !== "done" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-[20px] bg-surface p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">Файл</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-secondary">Жолдар</dt>
              <dd className="font-semibold text-text-primary">{parsed.rows.length.toLocaleString("ru-RU")}</dd>
              <dt className="text-text-secondary">Кезең</dt>
              <dd className="font-semibold text-text-primary">
                {parsed.from} — {parsed.to}
              </dd>
              <dt className="text-text-secondary">Қайта импорт</dt>
              <dd className="text-text-primary">Бұрын импортталған жолдар (№ бойынша) жаңартылады, қайталанбайды</dd>
            </dl>
          </section>
          <section className="rounded-[20px] bg-surface p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
              Соңғы 30 күнде жұмыс істеген менеджерлер — аккаунт ашылады
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {parsed.activeManagers.map((m) => (
                <li key={m.name} className="flex items-center justify-between py-2 text-sm">
                  <label className="flex items-center gap-2.5 font-semibold text-text-primary">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1f4fd8]"
                      checked={!!selected[m.name]}
                      onChange={(e) => setSelected((s) => ({ ...s, [m.name]: e.target.checked }))}
                    />
                    {m.name}
                  </label>
                  <span className="text-text-secondary">{m.rows} жол</span>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2.5 border-t border-border pt-3 text-sm text-text-secondary">
              <input type="checkbox" className="h-4 w-4 accent-[#1f4fd8]" checked={blockDemo} onChange={(e) => setBlockDemo(e.target.checked)} />
              Demo менеджерді («Асхат Нұрланов») бұғаттау — рейтингте көрінбесін
            </label>
          </section>
        </div>
      )}

      {parsed && (stage === "ready" || stage === "running") && (
        <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          {stage === "running" ? (
            <>
              <div className="flex justify-between text-sm font-semibold text-text-primary">
                <span>Импорт жүріп жатыр… бетті жаппаңыз</span>
                <span>
                  {progress.done.toLocaleString("ru-RU")} / {progress.total.toLocaleString("ru-RU")} · {pct}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-page-bg">
                <i className="block h-full rounded-full bg-[#1f4fd8] transition-all" style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={run}
              className="flex items-center justify-center gap-2 self-end rounded-xl bg-[#1f4fd8] px-6 py-3 text-sm font-bold text-white hover:bg-[#1a43b8]"
            >
              <Upload size={16} /> Аккаунттарды ашу және {parsed.rows.length.toLocaleString("ru-RU")} жолды импорттау
            </button>
          )}
        </div>
      )}

      {stage === "done" && parsed && (
        <>
          <div className="flex items-center gap-3 rounded-[20px] bg-[#e7f7ec] px-5 py-4 text-[#15803d]">
            <CheckCircle2 size={22} />
            <div className="text-sm">
              <b>Импорт аяқталды:</b> {parsed.rows.length.toLocaleString("ru-RU")} жол ({parsed.from} — {parsed.to}). Рейтинг жаңартылды.
            </div>
          </div>

          <section className="rounded-[20px] bg-surface p-5 print:shadow-none">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-text-primary">
                <KeyRound size={18} className="text-[#1f4fd8]" /> Менеджерлердің логині мен уақытша паролі
              </h2>
              {created.length > 0 && (
                <div className="flex gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(credText).then(() => setCopied(true))}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold text-text-primary hover:bg-page-bg"
                  >
                    <Copy size={14} /> {copied ? "Көшірілді" : "Көшіру"}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold text-text-primary hover:bg-page-bg"
                  >
                    <Printer size={14} /> Басып шығару
                  </button>
                </div>
              )}
            </div>
            {created.length > 0 ? (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-secondary">
                      <th className="py-2 pr-3">Менеджер</th>
                      <th className="py-2 pr-3">Логин</th>
                      <th className="py-2">Уақытша пароль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {created.map((c) => (
                      <tr key={c.login} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-3 font-semibold">{c.fullName}</td>
                        <td className="py-2.5 pr-3 font-mono">{c.login}</td>
                        <td className="py-2.5 font-mono text-base font-bold">{c.tempPassword}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-text-secondary">
                  Парольдер қайта көрсетілмейді — қазір көшіріп алыңыз да, әр менеджерге жеке беріңіз. Бірінші кіргенде менеджер өз паролін
                  қояды. Ұмытса — «Менеджерлер» бетінде «Жаңа пароль».
                </p>
              </>
            ) : (
              <p className="text-sm text-text-secondary">Жаңа аккаунт ашылған жоқ.</p>
            )}
            {existing.length > 0 && (
              <p className="mt-3 text-xs text-text-secondary">
                Аккаунты бұрыннан бар: {existing.map((e) => `${e.fullName} (${e.login})`).join(", ")}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
