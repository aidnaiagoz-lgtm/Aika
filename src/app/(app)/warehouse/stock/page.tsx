import Link from "next/link";
import { AlertTriangle, Plus, Ruler, Search, ShoppingCart, Wallet, X } from "lucide-react";
import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { canEditWarehouse, stockOverview, type StockFilter } from "@/lib/domain/warehouse/stock";
import { BulkMin } from "./BulkMin";
import { fmtQty } from "@/lib/domain/warehouse/stock-calc";
import { WH } from "../t";
import { CATEGORY_ORDER, StatusPill, Thumb } from "../ui";

export const dynamic = "force-dynamic";

/** Қойма → Қалдық (CEO, 2026-11-18): карточкалар (басқанда сүзгі), санаттар, іздеу, кесте. */
// «Аз қалды» — сары, «Бітті» — қызыл жол: көзге бірден түсу үшін (CEO, 2026-11-21)
const ROW_TONE: Partial<Record<string, { row: string; stripe: string; card: string }>> = {
  order: { row: "bg-[#fff8e6] hover:bg-[#fff1cc]", stripe: "shadow-[inset_4px_0_0_#f59e0b]", card: "bg-[#fff8e6] border-l-4 border-[#f59e0b]" },
  urgent: { row: "bg-[#fdeeee] hover:bg-[#fbe0e0]", stripe: "shadow-[inset_4px_0_0_#dc2626]", card: "bg-[#fdeeee] border-l-4 border-[#dc2626]" },
  low: { row: "bg-[#fff8e6] hover:bg-[#fff1cc]", stripe: "shadow-[inset_4px_0_0_#f59e0b]", card: "bg-[#fff8e6] border-l-4 border-[#f59e0b]" },
  out: { row: "bg-[#fdeeee] hover:bg-[#fbe0e0]", stripe: "shadow-[inset_4px_0_0_#dc2626]", card: "bg-[#fdeeee] border-l-4 border-[#dc2626]" },
};

const money = (n: number, mln: string) => (n >= 1_000_000 ? `${fmtQty(Math.round(n / 100_000) / 10)} ${mln} ₸` : `${fmtQty(Math.round(n))} ₸`);

export default async function StockPage({ searchParams }: { searchParams: Promise<{ f?: string; cat?: string; q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = WH[locale];
  const u = t.unit;
  const sp = await searchParams;
  const filter: StockFilter = sp.f === "low" || sp.f === "out" ? sp.f : "all";
  const cat = CATEGORY_ORDER.find((c) => c === sp.cat);
  const q = (sp.q ?? "").trim().slice(0, 60);

  let data;
  try {
    data = await stockOverview(user, { filter, category: cat, q });
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
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
    { key: null, label: t.stock.value, value: money(kpi.value, t.stock.million), sub: null, icon: Wallet, tone: "bg-accent-tint text-accent", ring: "" },
    { key: null, label: t.stock.leatherTotal, value: `${fmtQty(Math.round(kpi.leather))} м`, sub: kpi.leatherRolls > 0 ? t.rolls(kpi.leatherRolls) : null, icon: Ruler, tone: "bg-accent-tint text-accent", ring: "" },
    { key: "low", label: t.stock.needOrder, value: String(kpi.low), sub: t.stock.needOrderSub,  icon: AlertTriangle, tone: "bg-[#fff4e0] text-[#b45309]", ring: "outline outline-2 outline-[#f59e0b]" },
    { key: "out", label: t.stock.urgent, value: String(kpi.out + kpi.urgent), sub: t.stock.urgentSub,  icon: ShoppingCart, tone: "bg-danger/10 text-danger", ring: "outline outline-2 outline-danger" },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">{t.stock.title}</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">{t.stock.subtitle(total)}</p>
        </div>
        <Link href="/warehouse/receipts/new" className="flex items-center gap-1.5 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
          <Plus size={16} /> {t.receipt}
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
                <span className={`block whitespace-nowrap text-[19px] font-bold leading-tight sm:text-[22px] ${c.key === "out" && kpi.out + kpi.urgent > 0 ? "text-danger" : "text-text-primary"}`}>{c.value}</span>
                {c.sub && <span className="block text-xs text-text-secondary">{c.sub}</span>}
              </span>
              {active && (
                <span title={t.stock.clearFilter} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-page-bg text-text-secondary">
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
              {t.all} · {total}
            </Link>
            {CATEGORY_ORDER.filter((c) => byCategory.some(([k]) => k === c)).map((c) => (
              <Link key={c} href={href({ cat: c })} className={`whitespace-nowrap rounded-pill px-3.5 py-1.5 text-sm font-semibold ${cat === c ? "bg-accent/10 text-accent" : "text-text-secondary"}`}>
                {t.category[c]} · {byCategory.find(([k]) => k === c)?.[1]}
              </Link>
            ))}
          </nav>
        <form method="GET" action="/warehouse/stock" className="flex items-center gap-2 rounded-pill bg-surface px-4 shadow-card lg:w-[300px]">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          {cat && <input type="hidden" name="cat" value={cat} />}
          <Search size={16} className="text-text-secondary" />
          <input name="q" defaultValue={q} placeholder={t.stock.search} className="min-h-10 min-w-0 flex-1 bg-transparent text-sm focus:outline-none" />
        </form>
      </div>

      {canEditWarehouse(user) && (
        <div className="flex">
          <BulkMin locale={locale} current={cat} categories={CATEGORY_ORDER.filter((c) => byCategory.some(([k]) => k === c))} />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">
          {filter === "low" ? t.stock.emptyLow : filter === "out" ? t.stock.emptyOut : t.stock.emptyAll}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card bg-surface shadow-card md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page-bg text-left text-xs text-text-secondary">
                  {t.stock.cols.map((h) => (
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
                            {r.sku} · {t.category[r.category]}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums">
                      {fmtQty(r.stock)} {u(r.unit)}
                      {r.rolls != null && <div className="text-xs font-normal text-text-secondary">{t.rolls(r.rolls)}</div>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-text-secondary">{r.perDay != null ? t.perDay(fmtQty(Math.round(r.perDay * 10) / 10), u(r.unit)) : "—"}</td>
                    <td className={`whitespace-nowrap px-5 py-3 font-semibold tabular-nums ${r.status === "urgent" ? "text-danger" : r.status === "order" ? "text-[#b45309]" : "text-text-primary"}`}>
                      {r.days != null ? t.days(r.days) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill s={r.status} locale={locale} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums">
                      {r.order > 0 ? (
                        <>
                          <span className="font-bold text-text-primary">{r.orderRolls != null ? t.rollsExact(r.orderRolls) : `${fmtQty(Math.ceil(r.order))} ${u(r.unit)}`}</span>
                          {r.orderRolls != null && <div className="text-xs text-text-secondary">≈ {fmtQty(Math.ceil(r.order))} {u(r.unit)}</div>}
                        </>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-5 py-3 tabular-nums ${r.status === "low" ? "font-semibold text-[#b45309]" : "text-text-secondary"}`}>{r.min == null ? "—" : `${fmtQty(r.min)} ${u(r.unit)}`}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums">{r.price > 0 ? `${fmtQty(r.price)} ₸` : "—"}</td>
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
                    {r.sku} · {t.category[r.category]}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold tabular-nums">
                    {fmtQty(r.stock)} {u(r.unit)}
                  </span>
                  {r.rolls != null && <span className="text-xs text-text-secondary">{t.rolls(r.rolls)}</span>}
                  <StatusPill s={r.status} locale={locale} />
                  {r.days != null && <span className="text-xs text-text-secondary">{t.daysLeft(r.days)}</span>}
                  {r.order > 0 && (
                    <span className="text-xs font-bold text-text-primary">{t.stock.orderShort}: {r.orderRolls != null ? t.rollsExact(r.orderRolls) : `${fmtQty(Math.ceil(r.order))} ${u(r.unit)}`}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
