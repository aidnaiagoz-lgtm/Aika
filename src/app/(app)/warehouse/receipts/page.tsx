import Link from "next/link";
import { Plus } from "lucide-react";
import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { listReceipts } from "@/lib/domain/warehouse/stock";
import { fmtQty } from "@/lib/domain/warehouse/stock-calc";
import { Dot } from "../ui";

export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Almaty" });

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { saved } = await searchParams;
  let receipts;
  try {
    receipts = await listReceipts(user);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={await getLocale()} />;
    throw e;
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">Кіріс</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">Жеткізушіден келген материалдар · соңғы 100 накладная</p>
        </div>
        <Link href="/warehouse/receipts/new" className="flex items-center gap-1.5 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
          <Plus size={16} /> Жаңа кіріс
        </Link>
      </div>
      {saved && <p className="m-0 rounded-icon bg-[#e7f7ec] px-4 py-3 text-sm font-semibold text-[#15803d]">✓ Кіріс сақталды — қалдыққа қосылды.</p>}
      {receipts.length === 0 ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">
          Әлі кіріс жоқ. Алғашқы рет қоймадағы бар материалды «Жаңа кіріс» арқылы енгізіңіз — бұл бастапқы қалдық болады.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {receipts.map((r) => (
            <article key={r.id} className="rounded-card bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-text-primary">
                    {r.supplier}
                    {r.docNo && <span className="font-normal text-text-secondary"> · {r.docNo}</span>}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {day.format(r.date)} · {r.movements.length} позиция{r.paymentMethod ? ` · ${r.paymentMethod}` : ""}
                    {r.createdByName ? ` · ${r.createdByName}` : ""}
                  </div>
                </div>
                <div className="text-lg font-bold tabular-nums">{fmtQty(Number(r.total))} ₸</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.movements.map((m) => (
                  <Link key={m.id} href={`/warehouse/material/${m.materialId}`} className="flex items-center rounded-pill bg-page-bg px-3 py-1.5 text-[13px]">
                    <Dot name={m.material.name} />
                    {m.material.sku} · {m.material.name} · <b className="ml-1 tabular-nums">+{fmtQty(Number(m.qty))} {m.material.unit}</b>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
