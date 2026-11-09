"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, AlertTriangle, Settings, Upload, Check } from "lucide-react";
import type { KassaData, Stage } from "@/lib/domain/sales-kassa";
import { actAction, closeDayAction, kassaImportAction, setSeniorAction, setOpenFromAction } from "./actions";

// Касса — қарапайым тәртіп (қолданушы, 2026-11-09): менеджер қолма-қол ақшаны Еділ ағаға береді,
// Еділ аға «Алдым» басады. Еділ аға жоқта ғана — Зереге (ст МОП), ол кейін Еділ ағаға береді.

type Debt = { no: number; date: string | null; manager: string | null; customer: string | null; soldFor: number; paid: number; debt: number };
type Item = KassaData["items"][number];

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";
const almaty = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString();
const dmy = (iso: string) => almaty(iso).slice(0, 10).split("-").reverse().join(".");
const hm = (iso: string) => (iso.endsWith("T00:00:00.000Z") ? "" : almaty(iso).slice(11, 16));

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-border bg-surface p-5 ${className}`}>{children}</section>;
}
function Kpi({ l, v, s, tone }: { l: string; v: string; s: string; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-[16px] border border-border bg-surface px-4 py-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{l}</div>
      <div className={`mt-1.5 text-xl font-semibold ${tone === "warn" ? "text-[#b7791f]" : tone === "ok" ? "text-[#15803d]" : "text-text-primary"}`}>{v}</div>
      <div className="mt-0.5 text-xs text-text-secondary">{s}</div>
    </div>
  );
}

export function KassaClient({
  data,
  debts,
  leader,
  staff,
}: {
  data: KassaData;
  debts: Debt[];
  stageLabels?: Record<Stage, string>;
  leader: boolean;
  staff: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ t: string; bad?: boolean } | null>(null);
  const [tab, setTab] = useState<"todo" | "history">("todo");
  const flash = (t: string, bad = false) => {
    setToast({ t, bad });
    window.setTimeout(() => setToast(null), bad ? 4000 : 1800);
  };
  const run = (p: Promise<{ ok: boolean; error?: string; count?: number }>, okText: string) =>
    start(async () => {
      const r = await p;
      if (!r.ok) return flash(r.error ?? "Қате", true);
      flash(okText);
      router.refresh();
    });

  const senior = data.senior?.fullName ?? "Зере";
  const owner = data.role.owner;
  const stageText = (s: Stage) =>
    ({
      MANAGER: "менеджерде",
      HANDED_SENIOR: `${senior}ге берілді — растау күтуде`,
      HANDED_OWNER: "Еділ ағаға берілді — растау күтуде",
      SENIOR: `${senior}де`,
      OWNER: "Еділ аға алды",
      ARCHIVE: "архив",
    })[s];
  const stageTone = (s: Stage) =>
    s === "OWNER" ? "bg-[#e7f8ee] text-[#15803d]" : s === "MANAGER" ? "bg-[#fff6e0] text-[#8a5a00]" : s === "ARCHIVE" ? "bg-[#f0f1f4] text-[#5f6368]" : "bg-[#e8efff] text-[#1f4fd8]";

  // Менің істейтінім: менеджер — қолындағы ақша; Еділ аға — өзіне берілген; Зере — өзіне берілген
  // + менің берген, бірақ әлі расталмаған ақшам (батырмасыз — қайда тұрғанын көру үшін)
  const waiting = (i: Item) => !i.action && i.mine && (i.stage === "HANDED_OWNER" || i.stage === "HANDED_SENIOR" || i.stage === "SENIOR");
  const todo = data.items.filter((i) => i.action || waiting(i));
  const history = data.items.filter((i) => !i.action && !waiting(i));
  const actionable = todo.filter((i) => i.action);
  const shown = tab === "todo" ? todo : history;
  const todoSum = actionable.reduce((t, i) => t + i.amount, 0);

  const bulkLabel = owner ? "Бәрін алдым" : data.role.senior && actionable.every((i) => i.action === "SENIOR_RECEIVED") ? "Бәрін алдым" : "Бәрін Еділ ағаға бердім";
  const todoTitle = owner ? "Маған берілген ақша — растаңыз" : data.role.senior ? "Маған берілген / менің қолымдағы ақша" : "Менің қолымдағы қолма-қол ақша";

  return (
    <div className="flex flex-col gap-4">
      {!data.active ? (
        <>
          {leader && <ImportPanel />}
          <Card>
            <p className="text-sm text-text-secondary">Касса әлі қосылмаған — CEO / РОП бір рет ескі «касса» парағын импорттайды.</p>
          </Card>
        </>
      ) : (
        <>
          {/* Санақ: CEO-ға — бәрі, менеджерге — өзінікі */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi l={owner || leader ? "Менеджерлерде" : "Менің қолымда"} v={money(data.kpi.atManagers)} s="Еділ аға әлі алмаған" tone="warn" />
            <Kpi l={`${senior}де (ағай жоқта)`} v={money(data.kpi.atSenior)} s="Еділ ағаға берілуі керек" />
            <Kpi l="Бүгін Еділ аға алды" v={money(data.kpi.ownerToday)} s={`бүгін түскені: ${money(data.kpi.today)}`} tone="ok" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
                  <Banknote size={17} className="text-[#1f4fd8]" /> {tab === "todo" ? todoTitle : "Тарих (осы ай)"}
                </h2>
                <div className="ml-auto flex rounded-lg border border-border p-0.5 text-xs font-semibold">
                  <button onClick={() => setTab("todo")} className={`rounded-md px-3 py-1 ${tab === "todo" ? "bg-[#0b1a45] text-white" : "text-text-secondary"}`}>
                    Кезегім ({actionable.length})
                  </button>
                  <button onClick={() => setTab("history")} className={`rounded-md px-3 py-1 ${tab === "history" ? "bg-[#0b1a45] text-white" : "text-text-secondary"}`}>
                    Тарих
                  </button>
                </div>
              </div>

              {tab === "todo" && actionable.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-[14px] bg-page-bg px-3 py-2.5">
                  <span className="text-sm">
                    Барлығы: <b>{money(todoSum)}</b> · {actionable.length} төлем
                  </span>
                  <button
                    disabled={pending}
                    onClick={() => run(closeDayAction("owner"), "Белгіленді ✓")}
                    className="ml-auto rounded-xl bg-[#1f4fd8] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a43b8] disabled:opacity-50"
                  >
                    {bulkLabel}
                  </button>
                </div>
              )}

              {shown.length === 0 && (
                <p className="py-8 text-center text-sm text-text-secondary">
                  {tab === "todo" ? (owner ? "Сізге берілген, расталмаған ақша жоқ." : "Қолыңызда тапсырылмаған қолма-қол ақша жоқ ✓") : "Бұл айда тарих жоқ."}
                </p>
              )}
              {shown.map((i) => (
                <Row key={i.key} i={i} stageText={stageText} stageTone={stageTone} senior={senior} pending={pending} run={run} history={tab === "history"} />
              ))}
            </Card>

            <div className="flex min-w-0 flex-col gap-4">
              {(owner || leader) && data.holders.length > 0 && (
                <Card>
                  <h2 className="mb-2 text-[15px] font-semibold text-text-primary">Кімде қанша</h2>
                  {data.holders.map((h) => (
                    <div key={h.name} className="flex items-center justify-between border-t border-border py-2 text-sm first:border-t-0">
                      <span>{h.name}</span>
                      <b className="text-[#b7791f]">{money(h.amount)}</b>
                    </div>
                  ))}
                </Card>
              )}
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
                    <AlertTriangle size={16} className="text-[#b42318]" /> Клиент толық төлемеген
                  </h2>
                  <span className="text-xs text-text-secondary">{money(debts.reduce((t, d) => t + d.debt, 0))}</span>
                </div>
                {debts.length === 0 && <p className="text-sm text-text-secondary">Барлық клиент толық төлеген ✓</p>}
                <div className="max-h-[360px] overflow-y-auto">
                  {debts.map((d) => (
                    <div key={d.no} className="flex items-center justify-between border-t border-border py-2 text-sm first:border-t-0">
                      <div>
                        <b>№{d.no}</b> · {d.manager ?? "—"}
                        <div className="text-xs text-text-secondary">
                          {money(d.soldFor)} · түсті {money(d.paid)}
                        </div>
                      </div>
                      <b className="whitespace-nowrap text-[#b42318]">{money(d.debt)}</b>
                    </div>
                  ))}
                </div>
              </Card>
              {leader && <SettingsBox data={data} staff={staff} run={run} />}
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg ${toast.bad ? "bg-[#b42318] text-white" : "bg-[#202124] text-white"}`}>
          {toast.t}
        </div>
      )}
    </div>
  );
}

function Row({
  i,
  stageText,
  stageTone,
  senior,
  pending,
  run,
  history,
}: {
  i: Item;
  stageText: (s: Stage) => string;
  stageTone: (s: Stage) => string;
  senior: string;
  pending: boolean;
  run: (p: Promise<{ ok: boolean; error?: string }>, ok: string) => void;
  history: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border py-2.5 text-sm first:border-t-0">
      <div className="min-w-[160px] flex-1">
        <div>
          <b>№{i.no}</b> · {i.manager ?? "—"} · <b>{money(i.amount)}</b>
        </div>
        <div className="text-xs text-text-secondary">
          {i.at ? `${dmy(i.at)} ${hm(i.at)}` : ""} {i.customer ? `· ${i.customer}` : ""} · {i.kind}
        </div>
        {history && i.events.length > 0 && (
          <div className="mt-0.5 text-[11px] text-[#15803d]">
            {i.events.map((e, k) => (
              <span key={k} className="mr-2 inline-flex items-center gap-0.5">
                <Check size={11} /> {e.step === "HANDED" ? `берді → ${e.toName ?? ""}` : e.step === "SENIOR_RECEIVED" ? `${senior} алды` : "Еділ аға алды"} {dmy(e.at)} {e.source === "sheet" ? "" : hm(e.at)}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stageTone(i.stage)}`}>{stageText(i.stage)}</span>
      {i.action === "HANDED" && (
        <div className="flex gap-1.5">
          <button
            disabled={pending}
            onClick={() => run(actAction([i.key], "owner"), "Еділ ағаға берілді ✓")}
            className="whitespace-nowrap rounded-lg bg-[#1f4fd8] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1a43b8]"
          >
            Еділ ағаға бердім
          </button>
          <button
            disabled={pending}
            onClick={() => run(actAction([i.key], "senior"), `${senior}ге берілді ✓`)}
            title="Еділ аға жоқ кезде ғана"
            className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:bg-page-bg"
          >
            {senior}ге
          </button>
        </div>
      )}
      {(i.action === "OWNER_RECEIVED" || i.action === "SENIOR_RECEIVED") && (
        <button
          disabled={pending}
          onClick={() => run(actAction([i.key], "owner"), "Алынды ✓")}
          className="whitespace-nowrap rounded-lg bg-[#15803d] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#126b34]"
        >
          Алдым
        </button>
      )}
    </div>
  );
}

function SettingsBox({
  data,
  staff,
  run,
}: {
  data: KassaData;
  staff: { id: string; fullName: string }[];
  run: (p: Promise<{ ok: boolean; error?: string }>, ok: string) => void;
}) {
  return (
    <details className="rounded-[20px] border border-border bg-surface p-5 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-text-primary">
        <Settings size={15} className="text-text-secondary" /> Баптаулар
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-xs text-text-secondary">
        <label className="flex flex-wrap items-center gap-2">
          Ағай жоқта ақша кімге беріледі:
          <select
            defaultValue={data.senior?.id ?? ""}
            onChange={(e) => e.target.value && run(setSeniorAction(e.target.value), "Сақталды ✓")}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary"
          >
            <option value="">— таңдаңыз —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        </label>
        {data.openFrom && (
          <label className="flex flex-wrap items-center gap-2">
            Есеп басталатын күн (одан бұрынғы, расталмаған ақша — архив):
            <input
              type="date"
              defaultValue={almaty(data.openFrom).slice(0, 10)}
              onChange={(e) => e.target.value && run(setOpenFromAction(e.target.value), "Сақталды ✓")}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary"
            />
          </label>
        )}
        <ImportPanel compact />
      </div>
    </details>
  );
}

/** CEO / РОП: ескі «касса» парағының белгілерін бастапқы оқиға ретінде жүктеу — алдымен тексеру, сосын импорт. */
function ImportPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Extract<Awaited<ReturnType<typeof kassaImportAction>>, { ok: true }>["data"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = (dry: boolean) =>
    start(async () => {
      setErr(null);
      const r = await kassaImportAction(dry);
      if (!r.ok) return setErr(r.error);
      if (dry) setPreview(r.data);
      else {
        setPreview(null);
        router.refresh();
      }
    });
  return (
    <div className={compact ? "border-t border-border pt-3" : "rounded-[20px] border border-[#c6dafc] bg-[#f5f8ff] p-5"}>
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Upload size={15} className="text-[#1f4fd8]" /> Ескі «касса» парағын {compact ? "қайта " : ""}жүктеу
      </div>
      {preview && (
        <p className="mt-2 text-xs">
          Парақта {preview.rows} жол · сәйкес: {preview.matched} · оқиға: {preview.events}
        </p>
      )}
      {err && <p className="mt-2 text-xs text-[#b42318]">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button onClick={() => run(true)} disabled={pending} className="rounded-lg border border-[#1f4fd8] bg-white px-3 py-1.5 text-xs font-semibold text-[#1f4fd8] disabled:opacity-60">
          {pending ? "Жүріп жатыр…" : "Тексеру"}
        </button>
        {preview && (
          <button onClick={() => window.confirm("Жүктейміз бе?") && run(false)} disabled={pending} className="rounded-lg bg-[#1f4fd8] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
            Жүктеу
          </button>
        )}
      </div>
    </div>
  );
}
