"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, FileUp } from "lucide-react";
import { applyMoySkladAction, previewMoySkladAction } from "../actions";
import { CATEGORY_LABEL, fmtQty, parseMoySkladMatrix, type MoySkladRow } from "@/lib/domain/warehouse/stock-calc";
import type { MoySkladPreviewItem } from "@/lib/domain/warehouse/stock";
import { Dot } from "../ui";

type Preview = { items: MoySkladPreviewItem[]; summary: { total: number; matched: number; created: number; negative: number; nameDiffers: number; unitChanged: number; leather: number; value: number } };
type Tab = "all" | "warn" | "new";

export function MoySkladImport() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MoySkladRow[] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<{ items: number } | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  const onFile = (file: File) =>
    start(async () => {
      setError(null);
      setPreview(null);
      setDone(null);
      if (/\.xls$/i.test(file.name)) {
        setError("Бұл ескі .xls файл. Оны Excel-де ашып, «Сохранить как» → «Книга Excel (*.xlsx)» етіп сақтаңыз да, сол .xlsx файлын салыңыз.");
        return;
      }
      try {
        const { readSheet } = await import("read-excel-file/browser");
        const data = (await readSheet(file)) as unknown[][];
        const parsed = parseMoySkladMatrix(data);
        if (parsed.length === 0) throw new Error("Файлда «Цех/…» топтарындағы материал табылмады");
        const r = await previewMoySkladAction(parsed);
        if (!r.ok) throw new Error(r.error);
        setRows(parsed);
        setPreview(r.data as Preview);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Файлды оқу мүмкін болмады");
      }
    });

  const apply = () =>
    start(async () => {
      if (!rows) return;
      const r = await applyMoySkladAction(rows);
      if (!r.ok) return setError(r.error);
      setDone({ items: preview?.summary.total ?? 0 });
      setPreview(null);
    });

  const list = useMemo(() => {
    const items = preview?.items ?? [];
    if (tab === "warn") return items.filter((i) => i.msStock < 0 || i.nameDiffers || (i.siteUnit && i.siteUnit !== i.unit));
    if (tab === "new") return items.filter((i) => !i.siteName);
    return items;
  }, [preview, tab]);

  if (done) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card bg-surface p-6 shadow-card">
        <p className="m-0 text-base font-bold text-[#15803d]">✓ Қалдық МойСкладпен теңестірілді · {done.items} материал</p>
        <Link href="/warehouse/stock" className="rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white">
          Қалдыққа өту
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${pending ? "opacity-70" : ""}`}>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-border bg-surface p-8 text-center shadow-card hover:border-accent/50">
        <FileUp size={28} className="text-accent" />
        <span className="font-semibold text-text-primary">{pending ? "Оқылуда…" : "МойСклад файлын таңдаңыз (.xlsx)"}</span>
        <span className="text-xs text-text-secondary">«Остатки по товарам» есебі</span>
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {error && <p className="m-0 rounded-icon bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {preview && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Цех материалы", String(preview.summary.total), `${preview.summary.matched} сайтта бар · ${preview.summary.created} жаңа`],
              ["Кожа", `${fmtQty(preview.summary.leather)} м`, "МойСкладтағы қалдық"],
              ["Құны (жіпсіз)", `${fmtQty(preview.summary.value)} ₸`, "өзіндік құнымен"],
              ["Тексеру керек", String(preview.summary.negative + preview.summary.nameDiffers), `${preview.summary.negative} минус · ${preview.summary.nameDiffers} атауы басқа`],
            ].map(([k, v, h]) => (
              <div key={k} className="rounded-card bg-surface px-5 py-4 shadow-card">
                <div className="text-[13px] text-text-secondary">{k}</div>
                <div className="text-[22px] font-bold leading-tight">{v}</div>
                <div className="mt-0.5 text-xs text-text-secondary">{h}</div>
              </div>
            ))}
          </div>

          <div className="rounded-card border border-[#fde68a] bg-[#fffbeb] p-4 text-sm text-text-primary">
            <b>Жүктегенде не болады:</b> әр материалдың сайттағы қалдығы МойСкладтағыға теңестіріледі (айырмасы «Санау» болып тарихта қалады).
            МойСкладта <b>минус</b> тұрғандар — <b>0</b> болады. Өлшем бірлігі МойСкладтағыдай болады (мыс. Ева — дана). Жіптің бағасы алынбайды
            (МойСкладта шатасқан). Сайтта бар, бірақ МойСкладта жоқ материалдарға тимейді. Ештеңе өшірілмейді.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex gap-1 rounded-pill bg-surface p-1 shadow-card">
              {(
                [
                  ["all", `Барлығы · ${preview.summary.total}`],
                  ["warn", `Тексеру керек · ${preview.items.filter((i) => i.msStock < 0 || i.nameDiffers || (i.siteUnit && i.siteUnit !== i.unit)).length}`],
                  ["new", `Жаңа · ${preview.summary.created}`],
                ] as Array<[Tab, string]>
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-pill px-3.5 py-1.5 text-sm font-semibold ${tab === k ? "bg-accent/10 text-accent" : "text-text-secondary"}`}>
                  {l}
                </button>
              ))}
            </nav>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`${preview.summary.total} материалдың қалдығын МойСкладтағыға теңестіреміз бе?`)) apply();
              }}
              className="rounded-pill bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Жүктелуде…" : "Иә, жүктеймін"}
            </button>
          </div>

          <div className="overflow-hidden rounded-card bg-surface shadow-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page-bg text-left text-xs text-text-secondary">
                  {["Код", "Материал (МойСклад)", "Сайтта", "Санат", "Қазір сайтта", "Болады", "Бағасы", "Ескерту"].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-border px-4 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const warn = [
                    i.msStock < 0 ? `МойСкладта ${fmtQty(i.msStock)} → 0` : null,
                    i.nameDiffers ? "атауы басқа — тексеріңіз" : null,
                    i.siteUnit && i.siteUnit !== i.unit ? `бірлік: ${i.siteUnit} → ${i.unit}` : null,
                    !i.siteName ? "жаңа материал" : null,
                  ].filter(Boolean);
                  return (
                    <tr key={i.code} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 tabular-nums text-text-secondary">{i.code}</td>
                      <td className="px-4 py-2.5 font-semibold">
                        <Dot name={i.msName} />
                        {i.msName}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{i.siteName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{CATEGORY_LABEL[i.category]}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">{fmtQty(i.oldStock)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums">
                        {fmtQty(i.newStock)} {i.unit}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{i.price != null ? `${fmtQty(i.price)} ₸` : "—"}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {warn.length ? (
                          <span className={`inline-flex items-center gap-1 ${i.msStock < 0 || i.nameDiffers ? "text-[#b45309]" : "text-text-secondary"}`}>
                            {(i.msStock < 0 || i.nameDiffers) && <AlertTriangle size={13} />}
                            {warn.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-text-secondary/60">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
