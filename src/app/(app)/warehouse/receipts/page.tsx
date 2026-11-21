import Link from "next/link";
import { Plus } from "lucide-react";
import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { listReceipts } from "@/lib/domain/warehouse/stock";
import { fmtQty } from "@/lib/domain/warehouse/stock-calc";
import { Dot } from "../ui";
import { WH } from "../t";
import { PhotoZoom } from "../PhotoZoom";

export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Almaty" });

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ saved?: string; photoErr?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = WH[locale];
  const { saved, photoErr } = await searchParams;
  let receipts;
  try {
    receipts = await listReceipts(user);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">{t.receipt}</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">{t.rec.subtitle}</p>
        </div>
        <Link href="/warehouse/receipts/new" className="flex items-center gap-1.5 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
          <Plus size={16} /> {t.newReceipt}
        </Link>
      </div>
      {saved && <p className="m-0 rounded-icon bg-[#e7f7ec] px-4 py-3 text-sm font-semibold text-[#15803d]">{t.rec.saved}</p>}
      {photoErr && <p className="m-0 rounded-icon bg-[#fff4e0] px-4 py-3 text-sm font-semibold text-[#b45309]">{t.rec.photoErr}</p>}
      {receipts.length === 0 ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">
          {t.rec.empty}
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
                    {day.format(r.date)} · {t.rec.positions(r.movements.length)}{r.paymentMethod ? ` · ${r.paymentMethod}` : ""}
                    {r.createdByName ? ` · ${r.createdByName}` : ""}
                  </div>
                </div>
                <div className="text-lg font-bold tabular-nums">{fmtQty(Number(r.total))} ₸</div>
              </div>
              {r.photos.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-text-secondary">{t.rec.invoice}:</span>
                  {r.photos.map((ph, i) => (
                    <a key={ph.id} href={`/api/receipt-photo/${ph.id}`} target="_blank" rel="noreferrer">
                      <PhotoZoom src={`/api/receipt-photo/${ph.id}`} alt={`${t.rec.invoice} ${i + 1}`} size={48} />
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.movements.map((m) => (
                  <Link key={m.id} href={`/warehouse/material/${m.materialId}`} className="flex items-center rounded-pill bg-page-bg px-3 py-1.5 text-[13px]">
                    <Dot name={m.material.name} />
                    {m.material.sku} · {m.material.name} · <b className="ml-1 tabular-nums">+{fmtQty(Number(m.qty))} {t.unit(m.material.unit)}</b>
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
