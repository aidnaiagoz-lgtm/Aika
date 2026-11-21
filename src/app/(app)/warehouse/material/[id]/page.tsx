import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { materialDetail } from "@/lib/domain/warehouse/stock";
import { DEFAULT_ROLL_LENGTH, fmtQty, LEAD_DAYS, rollLengthFor, rollsOf } from "@/lib/domain/warehouse/stock-calc";
import { WH } from "../../t";
import { Dot, StatusPill } from "../../ui";
import { MaterialSettings } from "./MaterialSettings";
import { MaterialPhoto } from "./MaterialPhoto";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = WH[locale];
  const u = t.unit;
  const { id } = await params;
  let d;
  try {
    d = await materialDetail(user, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!d) notFound();
  const { material: m, moves, photo, photoBy, plan } = d;
  const stock = Number(m.currentStock);
  const min = m.minStock == null ? null : Number(m.minStock);
  const ownRoll = m.rollLength == null ? null : Number(m.rollLength);
  const rollLen = rollLengthFor(m.category, ownRoll);
  const rolls = rollsOf(stock, rollLen);

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-[13px] text-text-secondary">
        <Link href="/warehouse/stock" className="font-semibold text-accent">
          {t.warehouse}
        </Link>{" "}
        › {m.sku}
      </nav>
      <header className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-4">
          <MaterialPhoto id={m.id} name={m.name} photo={photo} locale={locale} />
          <div>
          <h1 className="m-0 flex items-center text-2xl font-bold text-text-primary">
            {!photo && <Dot name={m.name} />}
            {m.name}
          </h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">
            {t.code} {m.sku} · {t.category[m.category]}
            {m.supplier ? ` · ${t.mat.lastSupplier}: ${m.supplier}` : ""}
          </p>
          {photoBy && (
            <p className="m-0 mt-0.5 text-xs text-text-secondary">
              {t.mat.photoBy}: {photoBy.name ?? t.mat.photoUnknown} · {dt.format(photoBy.at)}
            </p>
          )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatusPill s={plan.status} locale={locale} />
          <div className="text-right">
            <div className="text-xs text-text-secondary">{t.mat.stock}</div>
            <div className="text-[26px] font-bold leading-tight tabular-nums">
              {fmtQty(stock)} {u(m.unit)}
            </div>
            {rolls != null && (
              <div className="text-sm text-text-secondary">
                {t.rolls(rolls)} <span className="text-xs">({t.mat.oneRoll(fmtQty(rollLen!), u(m.unit))})</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Заказ болжамы: соңғы 30 күндегі шығынмен (цех реестрі + қоймадан шыққаны) */}
      <section
        className={`grid grid-cols-2 gap-4 rounded-card p-5 shadow-card md:grid-cols-4 md:px-6 ${
          plan.status === "urgent" || plan.status === "out" ? "bg-[#fdeeee]" : plan.status === "order" || plan.status === "low" ? "bg-[#fff8e6]" : "bg-surface"
        }`}
      >
        <div>
          <div className="text-xs text-text-secondary">{t.mat.usage30}</div>
          <div className="text-lg font-bold tabular-nums">{plan.perDay != null ? t.perDay(fmtQty(Math.round(plan.perDay * 10) / 10), u(m.unit)) : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">{t.mat.lasts}</div>
          <div className={`text-lg font-bold tabular-nums ${plan.status === "urgent" ? "text-danger" : plan.status === "order" ? "text-[#b45309]" : ""}`}>
            {plan.days != null ? t.days(plan.days) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">{t.mat.lead}</div>
          <div className="text-lg font-bold tabular-nums">{t.days(m.leadDays ?? LEAD_DAYS)}</div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">{t.mat.order}</div>
          <div className="text-lg font-bold tabular-nums">
            {plan.order > 0 ? (plan.orderRolls != null ? t.rollsExact(plan.orderRolls) : `${fmtQty(Math.ceil(plan.order))} ${u(m.unit)}`) : "—"}
          </div>
          {plan.order > 0 && plan.orderRolls != null && <div className="text-xs text-text-secondary">≈ {fmtQty(Math.ceil(plan.order))} {u(m.unit)}</div>}
        </div>
        {plan.perDay == null && (
          <p className="col-span-full m-0 text-xs text-text-secondary">
            {t.mat.noForecast}
          </p>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-card bg-surface shadow-card">
          <h2 className="m-0 px-5 pb-3 pt-5 text-base font-bold">{t.mat.history}</h2>
          {moves.length === 0 ? (
            <p className="m-0 px-5 pb-5 text-sm text-text-secondary">{t.mat.noMoves}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page-bg text-left text-xs text-text-secondary">
                  {t.mat.histCols.map((h) => (
                    <th key={h} className="border-b border-border px-5 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moves.map((x) => {
                  const q = Number(x.qty);
                  return (
                    <tr key={x.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-text-secondary">{dt.format(x.createdAt)}</td>
                      <td className="px-5 py-3">{t.mat.kind[x.kind] ?? x.kind}</td>
                      <td className={`whitespace-nowrap px-5 py-3 font-semibold tabular-nums ${q < 0 ? "text-danger" : "text-[#15803d]"}`}>
                        {q > 0 ? "+" : "−"}
                        {fmtQty(Math.abs(q))} {u(m.unit)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums">{x.stockAfter == null ? "—" : `${fmtQty(Number(x.stockAfter))} ${u(m.unit)}`}</td>
                      <td className="px-5 py-3 text-[13px] text-text-secondary">
                        {[x.orderNo ? `№${x.orderNo}` : null, x.note, x.createdByName, x.unitPrice != null ? `${fmtQty(Number(x.unitPrice))} ₸` : null].filter(Boolean).join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <MaterialSettings locale={locale} id={m.id} unit={u(m.unit)} min={min} price={Number(m.costPrice)} roll={ownRoll} defaultRoll={DEFAULT_ROLL_LENGTH[m.category] ?? null} leadDays={m.leadDays} />
      </div>
    </div>
  );
}
