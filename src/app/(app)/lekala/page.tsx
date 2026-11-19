import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleHelp, Layers, Search, TriangleAlert, Car } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { canUseWorkshop } from "@/lib/access";
import { listLekala, type LekalaFilter } from "@/lib/domain/lekala";
import { LekalaRowActions, AddLekala } from "./LekalaClient";

export const dynamic = "force-dynamic";

/** Лекала (CEO, 2026-11-19): қай көлікке лекала бар — цех тарихынан өзі, цех/CEO қолмен толықтырады; менеджер сұраулары жоғарыда. */
const day = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const tm = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });

const PILL = {
  have: { label: "Бар", cls: "bg-[#e7f7ec] text-[#15803d]" },
  none: { label: "Жоқ", cls: "bg-[#fff4e0] text-[#b45309]" },
  asked: { label: "Сұралды", cls: "bg-accent/10 text-accent" },
} as const;

export default async function LekalaPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; req?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canUseWorkshop(user)) redirect("/dashboard");
  const sp = await searchParams;
  const filter: LekalaFilter = sp.f === "have" || sp.f === "asked" || sp.f === "none" ? sp.f : "all";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const { rows, total, counts } = await listLekala(user, { filter, q });
  const href = (f: LekalaFilter) => `/lekala${f === "all" && !q ? "" : `?${new URLSearchParams({ ...(f !== "all" ? { f } : {}), ...(q ? { q } : {}) })}`}`;

  const cards = [
    { label: "Лекала бар", value: `${counts.have} модель`, icon: Layers, tone: "bg-accent-tint text-accent" },
    { label: "Цехта тігілді", value: `${counts.sewn.toLocaleString("ru-RU")} рет`, icon: Car, tone: "bg-accent-tint text-accent" },
    { label: "Сұралды (жауапсыз)", value: String(counts.asked), icon: CircleHelp, tone: "bg-accent/10 text-accent" },
    { label: "Жоқ", value: String(counts.none), icon: TriangleAlert, tone: "bg-[#fff4e0] text-[#b45309]" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">Лекала</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">Қай көлікке лекала бар — цех тарихынан өзі толады, цех қолмен толықтырады</p>
        </div>
        <AddLekala />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {cards.map((c) => (
          <div key={c.label} className="flex items-center gap-3.5 rounded-card bg-surface px-4 py-4 shadow-card sm:px-5">
            <span className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-icon sm:flex ${c.tone}`}>
              <c.icon size={20} />
            </span>
            <span>
              <span className="block text-[13px] text-text-secondary">{c.label}</span>
              <span className="block whitespace-nowrap text-[19px] font-bold leading-tight sm:text-[22px]">{c.value}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-1 overflow-x-auto rounded-pill bg-surface p-1 shadow-card">
          {(
            [
              ["all", `Барлығы · ${counts.all}`],
              ["have", `Бар · ${counts.have}`],
              ["asked", `Сұралды · ${counts.asked}`],
              ["none", `Жоқ · ${counts.none}`],
            ] as Array<[LekalaFilter, string]>
          ).map(([f, l]) => (
            <Link key={f} href={href(f)} className={`whitespace-nowrap rounded-pill px-3.5 py-1.5 text-sm font-semibold ${filter === f ? "bg-accent/10 text-accent" : "text-text-secondary"}`}>
              {l}
            </Link>
          ))}
        </nav>
        <form method="GET" action="/lekala" className="flex items-center gap-2 rounded-pill bg-surface px-4 shadow-card lg:w-[300px]">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          <Search size={16} className="text-text-secondary" />
          <input name="q" defaultValue={q} placeholder="Марка немесе модель" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm focus:outline-none" />
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">Ештеңе табылмады.</p>
      ) : (
        <div className="overflow-hidden rounded-card bg-surface shadow-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-page-bg text-left text-xs text-text-secondary">
                {["Көлік", "Күйі", "Тігілді", "Соңғысы", "Дерек", ""].map((h, i) => (
                  <th key={i} className="whitespace-nowrap border-b border-border px-5 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = PILL[r.status];
                const hl = sp.req && r.request?.id === sp.req;
                return (
                  <tr key={r.key} className={`border-b border-border last:border-0 ${hl ? "bg-accent/5" : ""}`}>
                    <td className="px-5 py-3">
                      <span className="font-semibold text-text-primary">{r.make}</span> {r.model}
                      <div className="text-xs text-text-secondary">{r.years ?? (r.request?.year ? String(r.request.year) : "")}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-semibold ${p.cls}`}>{p.label}</span>
                      {r.request && (
                        <div className="mt-1 text-xs text-accent">
                          {r.request.status === "SEARCHING" ? "іздеп жатыр" : "сұрау"} · {r.request.by ?? "менеджер"} · {tm.format(new Date(r.request.at))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 font-semibold tabular-nums">{r.count || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-text-secondary">{day(r.last)}</td>
                    <td className="px-5 py-3 text-[13px] text-text-secondary">{r.source || "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <LekalaRowActions make={r.make} model={r.model} status={r.status} requestId={r.request?.id ?? null} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total > rows.length && <p className="m-0 px-5 py-3 text-xs text-text-secondary">Алғашқы {rows.length} көрсетілді — іздеуді қолданыңыз.</p>}
        </div>
      )}
    </div>
  );
}
