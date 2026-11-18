import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { materialDetail } from "@/lib/domain/warehouse/stock";
import { CATEGORY_LABEL, fmtQty, stockStatus } from "@/lib/domain/warehouse/stock-calc";
import { Dot, StatusPill } from "../../ui";
import { MaterialSettings } from "./MaterialSettings";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const KIND: Record<string, string> = { IN: "Кіріс", OUT: "Цехқа", ADJUST: "Түзету", COUNT: "Санау" };

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  let d;
  try {
    d = await materialDetail(user, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={await getLocale()} />;
    throw e;
  }
  if (!d) notFound();
  const { material: m, moves } = d;
  const stock = Number(m.currentStock);
  const min = m.minStock == null ? null : Number(m.minStock);

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-[13px] text-text-secondary">
        <Link href="/warehouse/stock" className="font-semibold text-accent">
          Қойма
        </Link>{" "}
        › {m.sku}
      </nav>
      <header className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <h1 className="m-0 flex items-center text-2xl font-bold text-text-primary">
            <Dot name={m.name} />
            {m.name}
          </h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">
            Код {m.sku} · {CATEGORY_LABEL[m.category]}
            {m.supplier ? ` · соңғы жеткізуші: ${m.supplier}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusPill s={stockStatus(stock, min, moves.length > 0)} />
          <div className="text-right">
            <div className="text-xs text-text-secondary">Қалдық</div>
            <div className="text-[26px] font-bold leading-tight tabular-nums">
              {fmtQty(stock)} {m.unit}
            </div>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-card bg-surface shadow-card">
          <h2 className="m-0 px-5 pb-3 pt-5 text-base font-bold">Қозғалыс тарихы</h2>
          {moves.length === 0 ? (
            <p className="m-0 px-5 pb-5 text-sm text-text-secondary">Әлі қозғалыс жоқ. «Кіріс» арқылы бастапқы қалдықты енгізіңіз.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page-bg text-left text-xs text-text-secondary">
                  {["Уақыты", "Түрі", "Саны", "Қалдық", "Кім / неге"].map((h) => (
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
                      <td className="px-5 py-3">{KIND[x.kind] ?? x.kind}</td>
                      <td className={`whitespace-nowrap px-5 py-3 font-semibold tabular-nums ${q < 0 ? "text-danger" : "text-[#15803d]"}`}>
                        {q > 0 ? "+" : "−"}
                        {fmtQty(Math.abs(q))} {m.unit}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums">{x.stockAfter == null ? "—" : `${fmtQty(Number(x.stockAfter))} ${m.unit}`}</td>
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
        <MaterialSettings id={m.id} unit={m.unit} min={min} price={Number(m.costPrice)} />
      </div>
    </div>
  );
}
