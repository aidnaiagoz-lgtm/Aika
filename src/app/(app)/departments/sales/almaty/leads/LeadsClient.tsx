"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, History, Filter, CircleHelp, ListChecks, PhoneCall, ArrowRight, Upload } from "lucide-react";
import type { LeadItem } from "@/lib/domain/sales-leads";
import { createLeadAction, updateLeadAction, convertLeadAction, phoneHistoryAction, leadImportAction } from "./actions";

type Opt = { code: string; label: string };
type Stats = { total: number; withPhone: number; sold: number; reasons: { code: string; label: string; count: number }[]; managers: string[] };
type History = Awaited<ReturnType<typeof phoneHistoryAction>>;
type Filters = { month: string; account?: string; manager?: string; reason?: string; today: boolean; status?: string };

const BRAND = "#1f4fd8";
const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";
const dmy = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10).split("-").reverse().join(".");
const ymd = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10) : "");
const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-[#1f4fd8] focus:ring-2 focus:ring-[#e8efff]";
const sel = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-[#1f4fd8]";
const ACC_KEY = "automax.leads.account";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-border bg-surface p-5 ${className}`}>{children}</section>;
}
function Title({ icon: Icon, title, hint }: { icon: typeof UserPlus; title: string; hint?: React.ReactNode }) {
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
const STATUS_TONE: Record<string, string> = {
  NEW: "bg-[#e8efff] text-[#1f4fd8]",
  IN_PROGRESS: "bg-[#fff6e0] text-[#8a5a00]",
  SOLD: "bg-[#e7f8ee] text-[#15803d]",
  LOST: "bg-[#f0f1f4] text-[#5f6368]",
};

export function LeadsClient({
  leads,
  stats,
  filters,
  myToday,
  accounts,
  reasons,
  statusLabels,
  accountLabels,
  leader,
  systemActive,
  links,
}: {
  leads: LeadItem[];
  stats: Stats;
  filters: Filters;
  myToday: number;
  accounts: Opt[];
  reasons: Opt[];
  statusLabels: Record<string, string>;
  accountLabels: Record<string, string>;
  leader: boolean;
  systemActive: boolean;
  links: { clear: string; today: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ t: string; bad?: boolean } | null>(null);
  const flash = (t: string, bad = false) => {
    setToast({ t, bad });
    window.setTimeout(() => setToast(null), bad ? 4000 : 1800);
  };

  // ── Жылдам форма ──
  const phoneRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [account, setAccount] = useState("OLX_1");
  const [car, setCar] = useState("");
  const [more, setMore] = useState(false);
  const [extra, setExtra] = useState({ customerName: "", city: "", reasonCode: "", followUpAt: "", comment: "" });
  const [history, setHistory] = useState<History>(null);

  useEffect(() => {
    try {
      const a = localStorage.getItem(ACC_KEY);
      // Соңғы таңдалған аккаунт (сервер рендерінде localStorage жоқ — сондықтан эффектте)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (a && accounts.some((x) => x.code === a)) setAccount(a);
    } catch {
      /* жеке терезеде localStorage болмауы мүмкін */
    }
  }, [accounts]);

  // Ереже 2: нөмір толық терілгенде тарихы бірден көрінеді
  const phoneComplete = phone.replace(/\D/g, "").length >= 10;
  useEffect(() => {
    if (!phoneComplete) return;
    const t = window.setTimeout(async () => {
      try {
        setHistory(await phoneHistoryAction(phone));
      } catch {
        setHistory(null);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [phone, phoneComplete]);
  const shownHistory = phoneComplete ? history : null;

  const save = (convert: boolean) => {
    start(async () => {
      try {
        localStorage.setItem(ACC_KEY, account);
      } catch {
        /* елемейміз */
      }
      const res = await createLeadAction({ phone, account, car, ...extra, convert });
      if (!res.ok) return flash(res.error, true);
      if (res.data?.redirect) return router.push(res.data.redirect);
      setPhone("");
      setCar("");
      setExtra({ customerName: "", city: "", reasonCode: "", followUpAt: "", comment: "" });
      setHistory(null);
      flash("Лид сақталды ✓");
      phoneRef.current?.focus();
    });
  };

  const patch = (id: string, p: Parameters<typeof updateLeadAction>[1]) =>
    start(async () => {
      const r = await updateLeadAction(id, p);
      flash(r.ok ? "Сақталды ✓" : r.error, !r.ok);
    });
  const convert = (id: string) =>
    start(async () => {
      const r = await convertLeadAction(id);
      if (!r.ok) return flash(r.error, true);
      router.push(r.data!.redirect);
    });

  const go = (k: string, v: string) => {
    const p = new URLSearchParams(window.location.search);
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete("today");
    router.push(`/departments/sales/almaty/leads?${p.toString()}`);
  };

  const pct = (a: number) => (stats.total ? Math.round((a / stats.total) * 100) : 0);
  const reasonTotal = stats.reasons.reduce((t, r) => t + r.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {leader && !systemActive && <ImportPanel />}

      {/* Сүзгілер */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={filters.account ?? ""} onChange={(e) => go("acc", e.target.value)} aria-label="Аккаунт">
          <option value="">Аккаунт: барлығы</option>
          {accounts.map((a) => (
            <option key={a.code} value={a.code}>{a.label}</option>
          ))}
        </select>
        <select className={sel} value={filters.manager ?? ""} onChange={(e) => go("mgr", e.target.value)} aria-label="Менеджер">
          <option value="">Менеджер: барлығы</option>
          {stats.managers.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className={sel} value={filters.reason ?? ""} onChange={(e) => go("reason", e.target.value)} aria-label="Себеп">
          <option value="">Себеп: барлығы</option>
          {reasons.map((r) => (
            <option key={r.code} value={r.code}>{r.label}</option>
          ))}
        </select>
        <a
          href={links.today}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${filters.today ? "border-[#1f4fd8] bg-[#1f4fd8] text-white" : "border-[#1f4fd8] bg-[#e8efff] text-[#1f4fd8]"}`}
        >
          <PhoneCall size={14} /> Бүгін қоңырау ({myToday})
        </a>
        {(filters.account || filters.manager || filters.reason || filters.today) && (
          <a href={links.clear} className="text-sm text-text-secondary underline">тазалау</a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          {/* Жылдам форма — 3 өріс, қалғаны «Толығырақ» */}
          <Card>
            <Title icon={UserPlus} title="Жаңа лид" hint="Enter — сақтау" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save(false);
              }}
              className="flex flex-col gap-2.5"
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.3fr_1fr]">
                <input
                  ref={phoneRef}
                  autoFocus
                  inputMode="tel"
                  placeholder="Телефон *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`${inp} text-base font-semibold`}
                />
                <select value={account} onChange={(e) => setAccount(e.target.value)} className={inp} aria-label="Аккаунт">
                  {accounts.map((a) => (
                    <option key={a.code} value={a.code}>{a.label}</option>
                  ))}
                </select>
              </div>
              <input placeholder="Көлік (марка, модель)" value={car} onChange={(e) => setCar(e.target.value)} className={inp} />

              {shownHistory && (shownHistory.sales.length > 0 || shownHistory.leads.length > 0) && (
                <div className="rounded-[14px] border border-[#c6dafc] bg-[#f5f8ff] p-3 text-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-[#1f4fd8]">
                    <History size={15} /> Бұл нөмірдің тарихы
                  </div>
                  {shownHistory.sales.map((s, i) => (
                    <div key={`s${i}`} className="mt-1">
                      {s.date ? dmy(s.date) : "—"} <b className="text-[#15803d]">сатып алған</b> — №{s.no} {s.product ?? ""}
                      {s.soldFor != null ? `, ${money(s.soldFor)}` : ""} {s.manager ? `(${s.manager})` : ""}
                    </div>
                  ))}
                  {shownHistory.leads.map((l, i) => (
                    <div key={`l${i}`} className="mt-1 text-text-secondary">
                      {dmy(l.date)} лид болған — {l.managerName ?? "?"}, {accountLabels[l.account] ?? l.account}, {statusLabels[l.status]}
                    </div>
                  ))}
                </div>
              )}
              {shownHistory && shownHistory.sales.length === 0 && shownHistory.leads.length === 0 && (
                <div className="text-xs text-text-secondary">Бұл нөмір бойынша бұрын сатылым да, лид те болмаған — жаңа клиент.</div>
              )}

              {more && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input placeholder="Аты" value={extra.customerName} onChange={(e) => setExtra({ ...extra, customerName: e.target.value })} className={inp} />
                  <input placeholder="Қала" value={extra.city} onChange={(e) => setExtra({ ...extra, city: e.target.value })} className={inp} />
                  <select value={extra.reasonCode} onChange={(e) => setExtra({ ...extra, reasonCode: e.target.value })} className={inp} aria-label="Себеп">
                    <option value="">Себеп —</option>
                    {reasons.map((r) => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    Қайта қоңырау
                    <input type="date" value={extra.followUpAt} onChange={(e) => setExtra({ ...extra, followUpAt: e.target.value })} className={inp} />
                  </label>
                  <input placeholder="Түсіндірме" value={extra.comment} onChange={(e) => setExtra({ ...extra, comment: e.target.value })} className={`${inp} sm:col-span-2`} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" disabled={pending} className="rounded-xl bg-[#1f4fd8] px-5 py-2 text-sm font-bold text-white hover:bg-[#1a43b8] disabled:opacity-60">
                  Сақтау
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save(true)}
                  className="flex items-center gap-1 rounded-xl border border-[#1f4fd8] px-4 py-2 text-sm font-semibold text-[#1f4fd8] hover:bg-[#e8efff] disabled:opacity-60"
                >
                  Сақтап, сатылымға айналдыру <ArrowRight size={15} />
                </button>
                <button type="button" onClick={() => setMore(!more)} className="ml-auto text-xs font-semibold text-text-secondary underline">
                  {more ? "Жасыру" : "Толығырақ"}
                </button>
              </div>
            </form>
          </Card>

          <Card>
            <Title icon={Filter} title="Воронка" hint={filters.account ? accountLabels[filters.account] : "барлық аккаунт"} />
            {[
              ["Лид келді", stats.total, 100, BRAND],
              ["Телефон қалдырды", stats.withPhone, pct(stats.withPhone), BRAND],
              ["Сатып алды", stats.sold, pct(stats.sold), "#22c55e"],
            ].map(([l, v, w, c]) => (
              <div key={l as string} className="mb-2.5 text-sm">
                <div className="flex justify-between">
                  <span>{l}</span>
                  <b>
                    {v as number}
                    {l !== "Лид келді" && <span className="font-normal text-text-secondary"> · {w as number}%</span>}
                  </b>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e3e9f7]">
                  <i className="block h-full rounded-full" style={{ width: `${w as number}%`, background: c as string }} />
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <Title icon={CircleHelp} title="Неге алмады" hint={reasonTotal ? `${reasonTotal} лид` : undefined} />
            {stats.reasons.length === 0 ? (
              <p className="text-sm text-text-secondary">Бұл айда себеп белгіленген лид жоқ.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.reasons.map((r) => (
                  <button key={r.code} onClick={() => go("reason", r.code)} className="rounded-full bg-[#e8efff] px-3 py-1 text-xs font-semibold text-[#1f4fd8]">
                    {r.label} · {Math.round((r.count / reasonTotal) * 100)}%
                  </button>
                ))}
              </div>
            )}
          </Card>
      </div>

      <div>
        <Card className="min-w-0">
          <Title icon={ListChecks} title={filters.today ? "Бүгін қоңырау шалатын лидтер" : "Лидтер"} hint={leads.length} />
          {leads.length === 0 && <p className="py-6 text-center text-sm text-text-secondary">Лид жоқ</p>}

          {/* Телефон экраны — карточкалар */}
          <div className="flex flex-col gap-2 md:hidden">
            {leads.map((l) => (
              <div key={l.id} className="rounded-[14px] border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{l.customerName ?? "—"} · {l.car ?? ""}</div>
                    <div className="text-xs text-text-secondary">
                      {dmy(l.date)} · {accountLabels[l.account] ?? l.account} · {l.managerName ?? ""}
                    </div>
                    {l.phone && <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="text-xs font-semibold text-[#1f4fd8]">{l.phone}</a>}
                  </div>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[l.status]}`}>
                    {l.status === "SOLD" && l.saleNo ? `Сатылды №${l.saleNo}` : statusLabels[l.status]}
                  </span>
                </div>
                {l.comment && <div className="mt-1 text-xs text-text-secondary">{l.comment}</div>}
                {l.editable && l.status !== "SOLD" && <LeadActions l={l} reasons={reasons} onPatch={patch} onConvert={convert} pending={pending} />}
              </div>
            ))}
          </div>

          {/* Үлкен экран — кесте */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary">
                  {["Күні", "Аккаунт", "Менеджер", "Клиент · Көлік", "Себеп / түсіндірме", "Күйі", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-border px-1.5 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border align-top">
                    <td className="whitespace-nowrap px-1.5 py-2.5">{dmy(l.date)}</td>
                    <td className="whitespace-nowrap px-1.5 py-2.5">{accountLabels[l.account] ?? l.account}</td>
                    <td className="whitespace-nowrap px-1.5 py-2.5">{l.managerName ?? "—"}</td>
                    <td className="px-1.5 py-2.5">
                      <div>{l.customerName ?? "—"} · {l.car ?? ""}</div>
                      {l.phone && <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="whitespace-nowrap text-xs text-[#1f4fd8]">{l.phone}</a>}
                    </td>
                    <td className="max-w-[220px] px-1.5 py-2.5">
                      {l.editable && l.status !== "SOLD" ? (
                        <select
                          defaultValue={l.reasonCode ?? ""}
                          onChange={(e) => patch(l.id, { reasonCode: e.target.value || null })}
                          className="w-full rounded-md border border-border bg-surface px-1.5 py-1 text-xs"
                          aria-label="Себеп"
                        >
                          <option value="">—</option>
                          {reasons.map((r) => (
                            <option key={r.code} value={r.code}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs">{reasons.find((r) => r.code === l.reasonCode)?.label ?? ""}</span>
                      )}
                      {l.comment && <div className="mt-0.5 truncate text-xs text-text-secondary" title={l.comment}>{l.comment}</div>}
                    </td>
                    <td className="px-1.5 py-2.5">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[l.status]}`}>
                        {l.status === "SOLD" && l.saleNo ? `Сатылды №${l.saleNo}` : statusLabels[l.status]}
                      </span>
                      {l.followUpAt && l.status !== "SOLD" && <div className="mt-1 text-[11px] text-text-secondary">қоңырау: {dmy(l.followUpAt)}</div>}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-2.5 text-right">
                      {l.editable && l.status !== "SOLD" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="date"
                            defaultValue={ymd(l.followUpAt)}
                            onChange={(e) => patch(l.id, { followUpAt: e.target.value || null })}
                            title="Қайта қоңырау күні"
                            className="w-[118px] rounded-md border border-border bg-surface px-1 py-0.5 text-xs"
                          />
                          {l.status !== "LOST" && (
                            <button onClick={() => patch(l.id, { status: "LOST" })} className="rounded-md px-1.5 py-1 text-xs text-text-secondary hover:bg-page-bg" title="Жабу (алмады)">
                              Жабу
                            </button>
                          )}
                          <button
                            onClick={() => convert(l.id)}
                            disabled={pending}
                            className="flex items-center gap-1 rounded-lg border border-[#1f4fd8] px-2.5 py-1 text-xs font-semibold text-[#1f4fd8] hover:bg-[#e8efff]"
                          >
                            <ArrowRight size={13} /> Сатылым
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-text-secondary">ОЛХ-тан сатылым Продажиде жазылса — лид өзі «Сатылды» болады.</p>
        </Card>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg ${toast.bad ? "bg-[#b42318] text-white" : "bg-[#202124] text-white"}`}>
          {toast.t}
        </div>
      )}
    </div>
  );
}

function LeadActions({
  l,
  reasons,
  onPatch,
  onConvert,
  pending,
}: {
  l: LeadItem;
  reasons: Opt[];
  onPatch: (id: string, p: Parameters<typeof updateLeadAction>[1]) => void;
  onConvert: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <select
        defaultValue={l.reasonCode ?? ""}
        onChange={(e) => onPatch(l.id, { reasonCode: e.target.value || null })}
        className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs"
        aria-label="Себеп"
      >
        <option value="">Себеп —</option>
        {reasons.map((r) => (
          <option key={r.code} value={r.code}>{r.label}</option>
        ))}
      </select>
      <input type="date" defaultValue={ymd(l.followUpAt)} onChange={(e) => onPatch(l.id, { followUpAt: e.target.value || null })} className="rounded-md border border-border bg-surface px-1 py-0.5 text-xs" />
      <button onClick={() => onConvert(l.id)} disabled={pending} className="ml-auto flex items-center gap-1 rounded-lg border border-[#1f4fd8] px-2.5 py-1 text-xs font-semibold text-[#1f4fd8]">
        <ArrowRight size={13} /> Сатылым
      </button>
    </div>
  );
}

/** CEO / РОП: olx парақтарын импорттау — алдымен тексеру (dry-run), сосын растап импорттау. */
function ImportPanel() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Extract<Awaited<ReturnType<typeof leadImportAction>>, { ok: true }>["data"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = (dry: boolean) =>
    start(async () => {
      setErr(null);
      const r = await leadImportAction(dry);
      if (!r.ok) return setErr(r.error);
      if (dry) setPreview(r.data!);
      else {
        setPreview(null);
        router.refresh();
      }
    });
  return (
    <section className="rounded-[20px] border border-[#c6dafc] bg-[#f5f8ff] p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
        <Upload size={17} className="text-[#1f4fd8]" /> olx және olx новый парақтарын импорттау
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Алдымен «Тексеру» — базаға ештеңе жазылмайды, тек не болатыны көрсетіледі. Сосын «Импорттау». Қайта іске қосқанда дубль жасалмайды.
      </p>
      {preview && (
        <div className="mt-3 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary">
                {["Парақ", "Жол", "Телефоны бар", "Жаңа", "Жаңартылады", "Біріктіріледі", "Өзгеріссіз"].map((h) => (
                  <th key={h} className="px-2 py-1 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sheets.map((s) => (
                <tr key={s.sheet}>
                  <td className="px-2 py-1 font-semibold">{s.sheet}</td>
                  <td className="px-2 py-1">{s.rows}</td>
                  <td className="px-2 py-1">{s.withPhone}</td>
                  <td className="px-2 py-1">{s.created}</td>
                  <td className="px-2 py-1">{s.updated}</td>
                  <td className="px-2 py-1">{s.merged}</td>
                  <td className="px-2 py-1">{s.unchanged}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-text-secondary">
            Продажи: {preview.backfill.rows} жолдың телефон/канал коды толтырылады ({preview.backfill.withPhone} телефон, {preview.backfill.olx} ОЛХ сатылымы). Ескі ОЛХ
            сатылымдары бар лидтермен ғана байланыстырылады — ескі сатылымдарға жаңа лид жасалмайды.
          </p>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-[#b42318]">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => run(true)} disabled={pending} className="rounded-xl border border-[#1f4fd8] bg-white px-4 py-2 text-sm font-semibold text-[#1f4fd8] disabled:opacity-60">
          {pending ? "Жүріп жатыр…" : "Тексеру (dry-run)"}
        </button>
        {preview && (
          <button
            onClick={() => window.confirm("Импортты бастаймыз ба? Лидтер базаға жазылады.") && run(false)}
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
