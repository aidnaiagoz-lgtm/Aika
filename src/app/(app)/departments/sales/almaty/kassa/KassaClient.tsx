"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, AlertTriangle, Users, Upload, Check } from "lucide-react";
import type { KassaData, Stage } from "@/lib/domain/sales-kassa";
import { actAction, closeDayAction, kassaImportAction, setSeniorAction, setOpenFromAction } from "./actions";

type Debt = { no: number; date: string | null; manager: string | null; customer: string | null; soldFor: number; paid: number; debt: number };

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";
const almaty = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString();
const dmy = (iso: string) => almaty(iso).slice(0, 10).split("-").reverse().join(".");
// Тек күні жазылған мән (UTC түн ортасы) — уақытын көрсетпейміз
const hm = (iso: string) => (iso.endsWith("T00:00:00.000Z") ? "" : almaty(iso).slice(11, 16));
const STEP_LABEL = { HANDED: "тапсырды", SENIOR_RECEIVED: "ст МОП қабылдады", OWNER_RECEIVED: "Еділ аға қабылдады" } as const;
const ACTION_LABEL = { HANDED: "Тапсырдым", SENIOR_RECEIVED: "Қабылдадым", OWNER_RECEIVED: "Қабылдадым" } as const;
const TONE: Record<Stage, string> = {
  MANAGER: "bg-[#fff6e0] text-[#8a5a00]",
  HANDED_SENIOR: "bg-[#e8efff] text-[#1f4fd8]",
  HANDED_OWNER: "bg-[#e8efff] text-[#1f4fd8]",
  SENIOR: "bg-[#eef2ff] text-[#3b4b9c]",
  OWNER: "bg-[#e7f8ee] text-[#15803d]",
  ARCHIVE: "bg-[#f0f1f4] text-[#5f6368]",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-border bg-surface p-5 ${className}`}>{children}</section>;
}
function Title({ icon: Icon, title, hint }: { icon: typeof Banknote; title: string; hint?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
        <Icon size={17} className="text-[#1f4fd8]" strokeWidth={2} />
        {title}
      </h2>
      {hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </div>
  );
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
  stageLabels,
  leader,
  staff,
}: {
  data: KassaData;
  debts: Debt[];
  stageLabels: Record<Stage, string>;
  leader: boolean;
  staff: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ t: string; bad?: boolean } | null>(null);
  const [to, setTo] = useState<"senior" | "owner">("senior");
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

  const seniorName = data.senior?.fullName ?? "ст МОП";
  const mineCount = data.myPending;
  const closeLabel = data.role.owner ? "Күнді жабу — бәрін қабылдадым" : data.role.senior ? "Күнді жабу — қабылдадым" : "Күнді жабу — бәрін тапсырдым";

  return (
    <div className="flex flex-col gap-4">
      {leader && <ImportPanel active={data.active} />}

      {!data.active ? (
        <Card>
          <p className="text-sm text-text-secondary">
            Касса әлі қосылмаған. Алдымен CEO / РОП ескі «касса» парағын импорттайды — сонда бұрын тапсырылған ақша қайта «менеджердің қолында» болып көрінбейді.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi l="Бүгін қолма-қол түсті" v={money(data.kpi.today)} s={`Продажиден өзі · ${data.kpi.todayCount} төлем`} />
            <Kpi l="Менеджерлердің қолында" v={money(data.kpi.atManagers)} s="әлі қабылданбаған" tone="warn" />
            <Kpi l={`${seniorName}-та (ст МОП)`} v={money(data.kpi.atSenior)} s="Еділ ағаға тапсыру күтуде" />
            <Kpi l="Еділ аға қабылдады" v={money(data.kpi.ownerToday)} s="бүгін" tone="ok" />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-border bg-surface px-4 py-3">
            <span className="text-sm">
              Менің кезегімде: <b>{mineCount}</b> төлем
            </span>
            {!data.role.owner && !data.role.senior && (
              <select value={to} onChange={(e) => setTo(e.target.value as "senior" | "owner")} className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm" aria-label="Кімге">
                <option value="senior">{seniorName}-ға (ст МОП)</option>
                <option value="owner">Еділ ағаға</option>
              </select>
            )}
            <button
              disabled={pending || mineCount === 0}
              onClick={() => run(closeDayAction(to), "Белгіленді ✓")}
              className="ml-auto rounded-xl bg-[#1f4fd8] px-5 py-2 text-sm font-bold text-white hover:bg-[#1a43b8] disabled:opacity-50"
            >
              {closeLabel}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card className="min-w-0">
              <Title icon={Banknote} title="Қолма-қол төлемдер — тапсыру тізбегі" hint="Продажиден өзі толады" />
              {data.items.length === 0 && <p className="py-6 text-center text-sm text-text-secondary">Бұл айда қолма-қол төлем жоқ</p>}
              <div className="flex flex-col">
                {data.items.map((i) => (
                  <div key={i.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2.5 text-sm first:border-t-0">
                    <div className="min-w-[150px] flex-1">
                      <div>
                        <b>№{i.no}</b> · {i.manager ?? "—"} · <b>{money(i.amount)}</b> <span className="text-xs text-text-secondary">({i.kind})</span>
                      </div>
                      <div className="text-xs text-text-secondary">
                        {i.at ? `${dmy(i.at)} ${hm(i.at)}` : ""} {i.customer ? `· ${i.customer}` : ""}
                      </div>
                      {i.events.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[#15803d]">
                          {i.events.map((e, k) => (
                            <span key={k}>
                              <Check size={11} className="inline" /> {e.step === "HANDED" && e.toName ? `→ ${e.toName}` : STEP_LABEL[e.step]} {dmy(e.at)}
                              {e.source === "sheet" ? "" : ` ${hm(e.at)}`}
                              {e.who ? ` (${e.who})` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE[i.stage]}`}>{stageLabels[i.stage]}</span>
                    {i.action && (
                      <button
                        disabled={pending}
                        onClick={() => run(actAction([i.key], to), "Белгіленді ✓")}
                        className="whitespace-nowrap rounded-lg border border-[#1f4fd8] px-3 py-1 text-xs font-semibold text-[#1f4fd8] hover:bg-[#e8efff]"
                      >
                        {ACTION_LABEL[i.action]}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-text-secondary">Әр белгі — кім, қашан басқаны сақталады (оқиға, белгіше емес).</p>
            </Card>

            <div className="flex min-w-0 flex-col gap-4">
              <Card>
                <Title icon={Users} title="Кімнің қолында қанша" />
                {data.holders.length === 0 && <p className="text-sm text-text-secondary">Барлық ақша Еділ ағаға тапсырылған.</p>}
                {data.holders.map((h) => (
                  <div key={h.name} className="flex items-center justify-between border-t border-border py-2 text-sm first:border-t-0">
                    <span>{h.name}</span>
                    <b className="text-[#b7791f]">{money(h.amount)}</b>
                  </div>
                ))}
                {leader && data.openFrom && (
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-text-secondary">
                    Есеп басталатын күн:
                    <input
                      type="date"
                      defaultValue={almaty(data.openFrom).slice(0, 10)}
                      onChange={(e) => e.target.value && run(setOpenFromAction(e.target.value), "Сақталды ✓")}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary"
                    />
                  </div>
                )}
                {leader && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                    ст МОП:
                    <select
                      defaultValue={data.senior?.id ?? ""}
                      onChange={(e) => e.target.value && run(setSeniorAction(e.target.value), "ст МОП сақталды ✓")}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary"
                    >
                      <option value="">— таңдаңыз —</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.fullName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </Card>
              <Card>
                <Title icon={AlertTriangle} title="Сатылым − төлем айырмасы" hint={`${debts.length} · ${money(debts.reduce((t, d) => t + d.debt, 0))}`} />
                {debts.length === 0 && <p className="text-sm text-text-secondary">Барлық клиент толық төлеген.</p>}
                <div className="max-h-[420px] overflow-y-auto">
                  {debts.map((d) => (
                    <div key={d.no} className="flex items-center justify-between border-t border-border py-2.5 text-sm first:border-t-0">
                      <div>
                        <div className="font-semibold">
                          №{d.no} · {d.manager ?? "—"}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {money(d.soldFor)} сатылды · {money(d.paid)} түсті {d.date ? `· ${dmy(d.date)}` : ""}
                        </div>
                      </div>
                      <b className="whitespace-nowrap text-[#b42318]">{money(d.debt)}</b>
                    </div>
                  ))}
                </div>
              </Card>
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

/** CEO / РОП: ескі «касса» парағының белгілерін бастапқы оқиға ретінде жүктеу — алдымен тексеру, сосын импорт. */
function ImportPanel({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(!active);
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
        setOpen(false);
        router.refresh();
      }
    });
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="self-start text-xs text-text-secondary underline">
        Ескі «касса» парағынан қайта жүктеу
      </button>
    );
  return (
    <section className="rounded-[20px] border border-[#c6dafc] bg-[#f5f8ff] p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
        <Upload size={17} className="text-[#1f4fd8]" /> Ескі «касса» парағын импорттау
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        «ст МОП берілді / қабылданды / Еділ аға» белгілері бастапқы оқиға болып жазылады. Алдымен «Тексеру» — базаға ештеңе жазылмайды. Қайта жүктесе дубль болмайды.
      </p>
      {preview && (
        <p className="mt-3 text-sm">
          Парақта <b>{preview.rows}</b> жол · Продажимен сәйкес: <b>{preview.matched}</b> · табылмады: {preview.notFound} · жазылатын оқиға: <b>{preview.events}</b> (тапсырды{" "}
          {preview.handed}, ст МОП қабылдады {preview.seniorOk}, Еділ аға қабылдады {preview.ownerOk})
        </p>
      )}
      {err && <p className="mt-2 text-sm text-[#b42318]">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => run(true)} disabled={pending} className="rounded-xl border border-[#1f4fd8] bg-white px-4 py-2 text-sm font-semibold text-[#1f4fd8] disabled:opacity-60">
          {pending ? "Жүріп жатыр…" : "Тексеру (dry-run)"}
        </button>
        {preview && (
          <button
            onClick={() => window.confirm("Импортты бастаймыз ба?") && run(false)}
            disabled={pending}
            className="rounded-xl bg-[#1f4fd8] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Импорттау
          </button>
        )}
      </div>
    </section>
  );
}
