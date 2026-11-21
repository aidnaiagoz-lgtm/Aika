import Link from "next/link";
import { AlertTriangle, Plus, Ruler, Search, ShoppingCart, Wallet, X } from "lucide-react";
import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { stockOverview, type StockFilter } from "@/lib/domain/warehouse/stock";
import { CATEGORY_LABEL, fmtQty } from "@/lib/domain/warehouse/stock-calc";
import { CATEGORY_ORDER, relDay, StatusPill, Thumb } from "../ui";

export const dynamic = "force-dynamic";

/** Қойма → Қалдық (CEO, 2026-11-18): карточкалар (басқанда сүзгі), санаттар, іздеу, кесте. */
// «Аз қалды» — сары, «Бітті» — қызыл жол: көзге бірден түсу үшін (CEO, 2026-11-21)
const ROW_TONE: Partial<Record<string, { row: string; stripe: string; card: string }>> = {
  low: { row: "bg-[#fff8e6] hover:bg-[#fff1cc]", stripe: "shadow-[inset_4px_0_0_#f59e0b]", card: "bg-[#fff8e6] border-l-4 border-[#f59e0b]" },
  out: { row: "bg-[#fdeeee] hover:bg-[#fbe0e0]", stripe: "shadow-[inset_4px_0_0_#dc2626]", card: "bg-[#fdeeee] border-l-4 border-[#dc2626]" },
};

const money = (n: number) => (n >= 1_000_000 ? `${fmtQty(Math.round(n / 100_000) / 10)} млн ₸` : `${fmtQty(Math.round(n))} ₸`);

export default async function StockPage({ searchParams }: { searchParams: Promise<{ f?: string; cat?: string; q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  const filter: StockFilter = sp.f === "low" || sp.f === "out" ? sp.f : "all";
  const cat = CATEGORY_ORDER.find((c) => c === sp.cat);
  const q = (sp.q ?? "").trim().slice(0, 60);

  let data;
  try {
    data = await stockOverview(user, { filter, category: cat, q });
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={await getLocale()} />;
    throw e;
  }
  const { rows, kpi, byCategory, total } = data;

  const href = (p: { f?: string | null; cat?: string | null; q?: string | null }) => {
    const u = new URLSearchParams();
    const f = p.f === undefined ? (filter === "all" ? null : filter) : p.f;
    const c = p.cat === undefined ? cat ?? null : p.cat;
    const qq = p.q === undefined ? q || null : p.q;
    if (f) u.set("f", f);
    if (c) u.set("cat", c);
    if (qq) u.set("q", qq);
    const s = u.toString();
    return `/warehouse/stock${s ? `?${s}` : ""}`;
  };

  const cards = [
    { key: null, label: "Қойма құны", value: money(kpi.value), icon: Wallet, tone: "bg-accent-tint text-accent", ring: "" },
    { key: null, label: "Кожа, барлығы", value: `${fmtQty(Math.round(kpi.leather))} м`, icon: Ruler, tone: "bg-accent-tint text-accent", ring: "" },
    { key: "low", label: "Аз қалды", value: String(kpi.low), icon: AlertTriangle, tone: "bg-[#fff4e0] text-[#b45309]", ring: "outline outline-2 outline-[#f59e0b]" },
    { key: "out", label: "Бітті", value: String(kpi.out), icon: ShoppingCart, tone: "bg-danger/10 text-danger", ring: "outline outline-2 outline-danger" },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">Қалдық</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">Қоймада қазір не бар · {total} материал</p>
        </div>
        <Link href="/warehouse/receipts/new" className="flex items-center gap-1.5 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
          <Plus size={16} /> Кіріс
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {cards.map((c) => {
          const active = c.key != null && filter === c.key;
          const body = (
            <>
              <span className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-icon sm:flex ${c.tone}`}>
                <c.icon size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-text-secondary">{c.label}</span>
                <span className={`block whitespace-nowrap text-[19px] font-bold leading-tight sm:text-[22px] ${c.key === "out" && kpi.out > 0 ? "text-danger" : "text-text-primary"}`}>{c.value}</span>
              </span>
              {active && (
                <span title="Қайта басса — сүзгі алынады" className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-page-bg text-text-secondary">
                  <X size={14} />
                </span>
              )}
            </>
          );
          const cls = `flex items-center gap-3.5 rounded-card bg-surface px-4 py-4 shadow-card sm:px-5 ${active ? c.ring : ""} ${filter !== "all" && !active ? "opacity-60" : ""}`;
          return c.key ? (
            <Link key={c.label} href={href({ f: active ? null : c.key })} className={`${cls} transition hover:-translate-y-px`}>
              {body}
            </Link>
          ) : (
            <div key={c.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-1 overflow-x-auto rounded-pill bg-surface p-1 shadow-card">
            <Link href={href({ cat: null })} className={`whitespace-nowrap rounded-pill px-3.5 py-1.5 text-sm font-semibold ${!cat ? "bg-accent/10 text-accent" : "text-text-secondary"}`}>
              Барлығы · {total}
            </Link>
            {CATEGORY_ORDER.filter((c) => byCategory.some(([k]) => k === c)).map((c) => (
              <Link key={c} href={href({ cat: c })} className={`whitespace-nowrap rounded-pill px-3.5 py-1.5 text-sm font-semibold ${cat === c ? "bg-accent/10 text-accent" : "text-text-secondary"}`}>
                {CATEGORY_LABEL[c]} · {byCategory.find(([k]) => k === c)?.[1]}
              </Link>
            ))}
          </nav>
        <form method="GET" action="/warehouse/stock" className="flex items-center gap-2 rounded-pill bg-surface px-4 shadow-card lg:w-[300px]">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          {cat && <input type="hidden" name="cat" value={cat} />}
          <Search size={16} className="text-text-secondary" />
          <input name="q" defaultValue={q} placeholder="Код немесе атауы" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm focus:outline-none" />
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">
          {filter === "low" ? "Аз қалған материал жоқ. Минимумды материалдың бетінде қоюға болады." : filter === "out" ? "Біткен материал жоқ." : "Ештеңе табылмады."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card bg-surface shadow-card md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page-bg text-left text-xs text-text-secondary">
                  {["Материал", "Қалдық", "Минимум", "Күйі", "Бағасы (1 бірлік)", "Соңғы қозғалыс"].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-border px-5 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-border last:border-0 ${ROW_TONE[r.status]?.row ?? "hover:bg-page-bg/50"}`}>
                    <td className={`px-5 py-3 ${ROW_TONE[r.status]?.stripe ?? ""}`}>
                      <Link href={`/warehouse/material/${r.id}`} className="flex items-center">
                        <Thumb name={r.name} photo={r.photo} />
                        <span>
                          <span className="block font-semibold text-text-primary">{r.name}</span>
                          <span className="text-xs text-text-secondary">
                            {r.sku} · {CATEGORY_LABEL[r.category]}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums">
                      {fmtQty(r.stock)} {r.unit}
                    </td>
                    <td className={`whitespace-nowrap px-5 py-3 tabular-nums ${r.status === "low" ? "font-semibold text-[#b45309]" : "text-text-secondary"}`}>{r.min == null ? "—" : `${fmtQty(r.min)} ${r.unit}`}</td>
                    <td className="px-5 py-3">
                      <StatusPill s={r.status} />
                      {r.days != null && (r.status === "low" || r.status === "ok") && <div className="mt-1 text-xs text-text-secondary">≈ {r.days} күнге жетеді</div>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums">{r.price > 0 ? `${fmtQty(r.price)} ₸` : "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-[13px] text-text-secondary">
                      {r.last
                        ? `${relDay(r.last.at)} · ${r.last.qty > 0 ? "+" : "−"}${fmtQty(Math.abs(r.last.qty))} ${r.unit}${r.last.orderNo ? ` · №${r.last.orderNo}` : r.last.kind === "IN" ? " · кіріс" : ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => (
              <Link key={r.id} href={`/warehouse/material/${r.id}`} className={`flex items-center gap-3 rounded-card p-4 shadow-card ${ROW_TONE[r.status]?.card ?? "bg-surface"}`}>
                <Thumb name={r.name} photo={r.photo} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-text-primary">{r.name}</div>
                  <div className="text-xs text-text-secondary">
                    {r.sku} · {CATEGORY_LABEL[r.category]}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold tabular-nums">
                    {fmtQty(r.stock)} {r.unit}
                  </span>
                  <StatusPill s={r.status} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
