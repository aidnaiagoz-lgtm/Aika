"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createReceiptAction } from "../../actions";
import { fmtQty, parseQty } from "@/lib/domain/warehouse/stock-calc";

interface Mat {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  stock: number;
  price: number;
}

type Line = { key: number; materialId: string; text: string; qty: string; price: string };

const label = (m: Mat) => `${m.sku} · ${m.name}`;
const inputCls = "min-h-11 w-full rounded-icon border border-border bg-surface px-3.5 text-[15px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";
const lbl = "mb-1.5 block text-xs font-semibold text-text-secondary";
const PAY = ["Kaspi", "Қолма-қол", "Аударым", "Қарызға"];

export function ReceiptForm({ materials, suppliers }: { materials: Mat[]; suppliers: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState("");
  const [docNo, setDocNo] = useState("");
  const [pay, setPay] = useState("Kaspi");
  const [lines, setLines] = useState<Line[]>([{ key: 1, materialId: "", text: "", qty: "", price: "" }]);

  // Күн — қолданушының өз сағатынан (сервер уақыты емес)
  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- бір рет, браузер сағатынан
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, []);

  const byLabel = useMemo(() => new Map(materials.map((m) => [label(m).toLowerCase(), m])), [materials]);
  const byId = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pick = (key: number, text: string) => {
    const t = text.trim().toLowerCase();
    const m = byLabel.get(t) ?? materials.find((x) => x.sku === t.split(/\s/)[0]);
    set(key, { text, materialId: m?.id ?? "", ...(m && m.price > 0 ? { price: String(m.price) } : {}) });
  };

  const rows = lines.map((l) => {
    const m = byId.get(l.materialId);
    const qty = parseQty(l.qty);
    const price = parseQty(l.price);
    return { l, m, qty, price, sum: qty != null && price != null ? qty * price : null };
  });
  const total = rows.reduce((s, r) => s + (r.sum ?? 0), 0);
  const filled = rows.filter((r) => r.m && r.qty);

  const submit = () =>
    start(async () => {
      if (rows.some((r) => r.l.text && !r.m)) return setError("Тізімнен материалды таңдаңыз (код немесе атауын жазып, ұсынылғанын басыңыз)");
      const r = await createReceiptAction({
        supplier,
        date,
        docNo,
        paymentMethod: pay,
        lines: filled.map((x) => ({ materialId: x.m!.id, qty: x.qty!, price: x.price })),
      });
      if (!r.ok) return setError(r.error);
      router.push("/warehouse/receipts?saved=1");
    });

  return (
    <div className={`grid items-start gap-5 lg:grid-cols-[1fr_360px] ${pending ? "opacity-70" : ""}`}>
      <section className="rounded-card bg-surface p-5 shadow-card md:p-6">
        <div className="mb-5 grid gap-3.5 md:grid-cols-[1.4fr_1fr_1fr]">
          <label>
            <span className={lbl}>Жеткізуші</span>
            <input list="suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="мыс. Кожа Маркет" className={inputCls} />
            <datalist id="suppliers">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            <span className={lbl}>Күні</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
          <label>
            <span className={lbl}>Накладная №</span>
            <input value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="міндетті емес" className={inputCls} />
          </label>
        </div>

        <datalist id="materials">
          {materials.map((m) => (
            <option key={m.id} value={label(m)} />
          ))}
        </datalist>

        <div className="overflow-hidden rounded-[16px] border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-page-bg text-left text-xs text-text-secondary">
                <th className="px-4 py-2.5 font-semibold">Материал</th>
                <th className="w-[120px] px-2 py-2.5 font-semibold">Саны</th>
                <th className="w-[130px] px-2 py-2.5 font-semibold">Бағасы (1 бірлік)</th>
                <th className="w-[120px] px-2 py-2.5 text-right font-semibold">Сомасы</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ l, m, sum }) => (
                <tr key={l.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <input list="materials" value={l.text} onChange={(e) => pick(l.key, e.target.value)} placeholder="Код немесе атауы…" className={`${inputCls} ${l.text && !m ? "border-danger/60" : ""}`} />
                    {m && (
                      <div className="mt-1 text-xs text-text-secondary">
                        Қазір: {fmtQty(m.stock)} {m.unit}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="relative">
                      <input inputMode="decimal" value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} placeholder="0" className={`${inputCls} pr-10 tabular-nums`} />
                      <span className="pointer-events-none absolute right-3 top-3 text-xs text-text-secondary">{m?.unit ?? ""}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input inputMode="decimal" value={l.price} onChange={(e) => set(l.key, { price: e.target.value })} placeholder="₸" className={`${inputCls} tabular-nums`} />
                  </td>
                  <td className="px-2 py-2 pt-4 text-right font-semibold tabular-nums">{sum != null ? `${fmtQty(Math.round(sum))} ₸` : "—"}</td>
                  <td className="py-2 pr-2 pt-3.5">
                    {lines.length > 1 && (
                      <button type="button" aria-label="Жолды өшіру" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded-full p-1 text-text-secondary hover:bg-page-bg">
                        <X size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, materialId: "", text: "", qty: "", price: "" }])}
          className="mt-3.5 flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary hover:bg-page-bg"
        >
          <Plus size={15} /> Материал қосу
        </button>
      </section>

      <aside className="flex flex-col gap-1 rounded-card bg-surface p-5 shadow-card lg:sticky lg:top-0">
        <h2 className="m-0 mb-3 text-base font-bold text-text-primary">Қорытынды</h2>
        <Row k="Позиция" v={String(filled.length)} />
        <Row k="Барлығы" v={`${fmtQty(Math.round(total))} ₸`} bold />
        <label className="mt-2 border-t border-border pt-3">
          <span className={lbl}>Төлем</span>
          <select value={pay} onChange={(e) => setPay(e.target.value)} className={inputCls}>
            {PAY.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        {filled.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <span className={lbl}>Қалдық қалай өзгереді</span>
            {filled.map(({ m, qty, l }) => (
              <div key={l.key} className="flex justify-between gap-3 py-1 text-sm">
                <span className="truncate text-text-secondary">{m!.name}</span>
                <span className="whitespace-nowrap tabular-nums">
                  {fmtQty(m!.stock)} → <b>{fmtQty(m!.stock + qty!)} {m!.unit}</b>
                </span>
              </div>
            ))}
          </div>
        )}
        {error && <p className="m-0 mt-2 rounded-icon bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button
          type="button"
          disabled={pending || filled.length === 0 || !supplier.trim()}
          onClick={submit}
          className="mt-3 min-h-12 rounded-pill bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Сақталуда…" : "Кірісті сақтау"}
        </button>
      </aside>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-text-secondary">{k}</span>
      <span className={`tabular-nums ${bold ? "font-bold text-text-primary" : "font-semibold"}`}>{v}</span>
    </div>
  );
}
