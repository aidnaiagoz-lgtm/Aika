"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";
import { createSalesOrderAction, type SalesOrderResult } from "./sales-actions";
import { autoGeneration, COUNTRY_OPTIONS, generationOptions, originCountryFor } from "./car-data";
import { canonicalMake } from "@/lib/domain/sales-ledger/normalize/car-make";

type Options = Record<string, string[]>;

interface ItemState {
  product: string;
  price: string;
  soldFor: string;
  leatherType: string;
  leatherThread: string;
  leatherPiping: string;
  matType: string;
  matThread: string;
  matPiping: string;
  pocketsPairs: string;
  pocketsLogo: boolean;
  workshop: boolean;
}
interface PayState {
  amount: string;
  method: string;
  date: string;
}

const today = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const emptyItem = (): ItemState => ({
  product: "", price: "", soldFor: "", leatherType: "", leatherThread: "", leatherPiping: "",
  matType: "", matThread: "", matPiping: "", pocketsPairs: "", pocketsLogo: false, workshop: true,
});
const num = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : null;
};
const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";

const inputCls =
  "min-h-11 w-full rounded-icon border border-border bg-page-bg px-3 text-[15px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-xs font-semibold text-text-secondary ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

function ListInput({ value, onChange, list, placeholder, inputMode }: { value: string; onChange: (v: string) => void; list?: string; placeholder?: string; inputMode?: "numeric" | "tel" | "text" }) {
  return <input className={inputCls} value={value} list={list} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} autoComplete="off" />;
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card sm:p-5">
      <h2 className="m-0 flex items-center gap-2.5 text-base font-bold text-text-primary">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-[13px] text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SalesOrderForm({
  options,
  priceByProduct,
  modelsByMake,
  managerName,
}: {
  options: Options;
  priceByProduct: Record<string, number>;
  /** Марка (кіші әріппен) → сол маркадағы модельдер — «Марка (модель)» тізімі тек сол маркаға қарай сүзіледі */
  modelsByMake: Record<string, string[]>;
  managerName: string;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("Алматы");
  const [channel, setChannel] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [generation, setGeneration] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [items, setItems] = useState<ItemState[]>([emptyItem()]);
  const [pays, setPays] = useState<PayState[]>([{ amount: "", method: "", date: today() }]);
  const [pickup, setPickup] = useState("");
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SalesOrderResult | null>(null);

  const setItem = (k: number, patch: Partial<ItemState>) => setItems((xs) => xs.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const setPay = (k: number, patch: Partial<PayState>) => setPays((xs) => xs.map((x, i) => (i === k ? { ...x, ...patch } : x)));

  // Марка жазылса — модель тізімі тек сол маркадағылар; марка белгісіз болса — барлығы
  const models = useMemo(() => {
    const key = canonicalMake(make).toLowerCase();
    if (!key) return options.brand ?? [];
    if (modelsByMake[key]) return modelsByMake[key];
    const near = Object.keys(modelsByMake).filter((k) => k.startsWith(key) || key.startsWith(k));
    return near.length ? [...new Set(near.flatMap((k) => modelsByMake[k]))] : options.brand ?? [];
  }, [make, modelsByMake, options.brand]);

  const genOptions = useMemo(() => generationOptions(make, model, num(year)), [make, model, year]);

  // Марка + модель + жыл бойынша буын бір ғана болса — өзі қойылады (менеджер өзгерте алады)
  function fillGeneration(mk: string, md: string, yr: string) {
    const code = autoGeneration(mk, md, num(yr));
    if (code) setGeneration(code);
  }

  const totals = useMemo(() => {
    const price = items.reduce((s, i) => s + (num(i.price) ?? num(i.soldFor) ?? 0), 0);
    const sold = items.reduce((s, i) => s + (num(i.soldFor) ?? num(i.price) ?? 0), 0);
    const paid = pays.reduce((s, p) => s + (num(p.amount) ?? 0), 0);
    return { price, sold, paid, rest: Math.max(0, sold - paid) };
  }, [items, pays]);

  function submit() {
    setResult(null);
    start(async () => {
      const r = await createSalesOrderAction({
        customer: { phone, name, city },
        channel,
        car: { make, model, year: num(year), generation, originCountry },
        items: items.map((i) => ({
          product: i.product,
          price: num(i.price),
          soldFor: num(i.soldFor),
          leatherType: i.leatherType,
          leatherThread: i.leatherThread,
          leatherPiping: i.leatherPiping,
          matType: i.matType,
          matThread: i.matThread,
          matPiping: i.matPiping,
          pocketsPairs: num(i.pocketsPairs),
          pocketsLogo: i.pocketsLogo,
          workshop: i.workshop,
        })),
        payments: pays.map((p) => ({ amount: num(p.amount) ?? 0, method: p.method, date: p.date })),
        pickupMethod: pickup,
        comment,
      });
      setResult(r);
      if (r.ok) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function reset() {
    setPhone(""); setName(""); setChannel(""); setMake(""); setModel(""); setYear(""); setGeneration(""); setOriginCountry("");
    setItems([emptyItem()]); setPays([{ amount: "", method: "", date: today() }]);
    setPickup(""); setComment(""); setResult(null);
  }

  if (result?.ok) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-card bg-surface p-8 text-center shadow-card">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[#e7f7ec] text-[#15803d]">
          <Check size={28} />
        </span>
        <h2 className="m-0 text-xl font-bold">Заказ сақталды · {result.orderNumber}</h2>
        <p className="m-0 text-sm text-text-secondary">
          Продажи кестесіне түсті: №{result.nos.join(", №")}. Рейтинг, касса{items.some((i) => i.workshop) ? ", цех (Бекзатқа хабар)" : ""} өзі жаңарды.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="min-h-11 rounded-pill bg-[#1f4fe0] px-5 text-sm font-bold text-white">
            + Тағы заказ
          </button>
          <Link href={`/orders/${result.orderId}`} className="flex min-h-11 items-center rounded-pill border border-border px-5 text-sm font-semibold">
            Заказды ашу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {Object.entries({
        "o-channel": options.contactChannel, "o-city": options.contactCity, "o-car": options.car, "o-brand": models,
        "o-product": options.product, "o-leather": options.leatherType, "o-thread": options.leatherThread, "o-piping": options.leatherPiping,
        "o-mat": options.matType, "o-matthread": options.matThread, "o-matpiping": options.matPiping, "o-pay": options.receipt1Method,
        "o-pickup": options.pickupMethod,
        "o-country": COUNTRY_OPTIONS,
      }).map(([id, list]) => (
        <datalist key={id} id={id}>
          {(list ?? []).map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      ))}
      <datalist id="o-generation">
        {genOptions.map((o) => (
          <option key={o.code + o.label} value={o.code} label={o.label} />
        ))}
      </datalist>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Section n={1} title="Клиент">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Телефон *">
              <ListInput value={phone} onChange={setPhone} placeholder="8 701 123 45 67" inputMode="tel" />
            </Field>
            <Field label="Аты *">
              <ListInput value={name} onChange={setName} placeholder="Клиенттің аты" />
            </Field>
            <Field label="Қаласы">
              <ListInput value={city} onChange={setCity} list="o-city" />
            </Field>
            <Field label="Канал обращения">
              <ListInput value={channel} onChange={setChannel} list="o-channel" placeholder="OLX, Instagram..." />
            </Field>
          </div>
        </Section>

        <Section n={2} title="Көлік">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Авто (марка)">
              <ListInput
                value={make}
                onChange={(v) => {
                  setMake(v);
                  const keepModel = !model || (modelsByMake[canonicalMake(v).toLowerCase()] ?? []).includes(model);
                  if (!keepModel) setModel("");
                  const country = originCountryFor(v);
                  if (country) setOriginCountry(country);
                  fillGeneration(v, keepModel ? model : "", year);
                }}
                list="o-car"
              />
            </Field>
            <Field label="Марка (модель)">
              <ListInput value={model} onChange={(v) => { setModel(v); fillGeneration(make, v, year); }} list="o-brand" />
            </Field>
            <Field label="Жылы">
              <ListInput value={year} onChange={(v) => { setYear(v); fillGeneration(make, model, v); }} inputMode="numeric" />
            </Field>
            <Field label="Буын (мыс. XV70)">
              <ListInput value={generation} onChange={setGeneration} list="o-generation" />
            </Field>
            <Field label="Қай елдің өндірісі">
              <ListInput value={originCountry} onChange={setOriginCountry} list="o-country" />
            </Field>
          </div>
        </Section>

        <Section n={3} title="Тауар">
          {items.map((it, k) => (
            <div key={k} className="flex flex-col gap-3 rounded-icon border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text-primary">Тауар {k + 1}</span>
                {items.length > 1 && (
                  <button type="button" aria-label="Тауарды алып тастау" onClick={() => setItems((xs) => xs.filter((_, i) => i !== k))} className="grid h-9 w-9 place-items-center rounded-icon text-text-secondary hover:bg-page-bg">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Товар *" wide>
                  <ListInput
                    value={it.product}
                    list="o-product"
                    placeholder="3Д - Люкс - салон полный 2 ряд"
                    onChange={(v) => setItem(k, { product: v, ...(priceByProduct[v] != null && !it.price ? { price: String(priceByProduct[v]) } : {}) })}
                  />
                </Field>
                <Field label="Кожа вид" wide>
                  <ListInput value={it.leatherType} onChange={(v) => setItem(k, { leatherType: v })} list="o-leather" />
                </Field>
                <Field label="Кожа нитка">
                  <ListInput value={it.leatherThread} onChange={(v) => setItem(k, { leatherThread: v })} list="o-thread" />
                </Field>
                <Field label="Кожа окантовка">
                  <ListInput value={it.leatherPiping} onChange={(v) => setItem(k, { leatherPiping: v })} list="o-piping" />
                </Field>
                <Field label="Съёмный полик вид" wide>
                  <ListInput value={it.matType} onChange={(v) => setItem(k, { matType: v })} list="o-mat" />
                </Field>
                <Field label="Съёмный нитка">
                  <ListInput value={it.matThread} onChange={(v) => setItem(k, { matThread: v })} list="o-matthread" />
                </Field>
                <Field label="Съёмный окантовка">
                  <ListInput value={it.matPiping} onChange={(v) => setItem(k, { matPiping: v })} list="o-matpiping" />
                </Field>
                <Field label="Кармашки (жұп)">
                  <ListInput value={it.pocketsPairs} onChange={(v) => setItem(k, { pocketsPairs: v })} inputMode="numeric" placeholder="1" />
                </Field>
                <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold text-text-primary">
                  <input type="checkbox" className="h-5 w-5" checked={it.pocketsLogo} onChange={(e) => setItem(k, { pocketsLogo: e.target.checked })} /> Кармашки лого
                </label>
                <label className="flex min-h-11 items-center gap-2 self-end rounded-icon bg-[#f1eeff] px-3 text-sm font-bold text-[#6a4ff5] sm:col-span-2">
                  <input type="checkbox" className="h-5 w-5" checked={it.workshop} onChange={(e) => setItem(k, { workshop: e.target.checked })} /> Цех — цехта тігіледі
                </label>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setItems((xs) => [...xs, emptyItem()])} className="flex items-center gap-1.5 self-start text-sm font-bold text-accent">
            <Plus size={16} /> Тағы тауар қосу
          </button>
        </Section>

        <Section n={4} title="Төлем">
          {items.map((it, k) => (
            <div key={k} className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
              <Field label={`Тауар ${k + 1}`}>
                <div className="flex min-h-11 items-center truncate text-[15px] font-semibold text-text-primary">{it.product || "—"}</div>
              </Field>
              <Field label="Цена">
                <ListInput value={it.price} onChange={(v) => setItem(k, { price: v })} inputMode="numeric" placeholder="95000" />
              </Field>
              <Field label="Продали за">
                <ListInput value={it.soldFor} onChange={(v) => setItem(k, { soldFor: v })} inputMode="numeric" placeholder={it.price || "90000"} />
              </Field>
            </div>
          ))}
          <hr className="my-1 border-border" />
          {pays.map((p, k) => (
            <div key={k} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
              <Field label={`Чек ${k + 1} сумма`}>
                <ListInput value={p.amount} onChange={(v) => setPay(k, { amount: v })} inputMode="numeric" placeholder="50000" />
              </Field>
              <Field label="Способ оплаты">
                <ListInput value={p.method} onChange={(v) => setPay(k, { method: v })} list="o-pay" placeholder="каспий пэй" />
              </Field>
              <Field label="Күні">
                <input type="date" className={inputCls} value={p.date} onChange={(e) => setPay(k, { date: e.target.value })} />
              </Field>
              <div className="flex items-end">
                {pays.length > 1 && (
                  <button type="button" aria-label="Чекті алып тастау" onClick={() => setPays((xs) => xs.filter((_, i) => i !== k))} className="grid h-11 w-11 place-items-center rounded-icon text-text-secondary hover:bg-page-bg">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setPays((xs) => [...xs, { amount: "", method: "", date: today() }])} className="flex items-center gap-1.5 self-start text-sm font-bold text-accent">
            <Plus size={16} /> Тағы чек
          </button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Способ вывоза">
              <ListInput value={pickup} onChange={setPickup} list="o-pickup" />
            </Field>
            <Field label="Комментарий" wide>
              <ListInput value={comment} onChange={setComment} />
            </Field>
          </div>
        </Section>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:w-[300px]">
        <div className="flex flex-col gap-1 rounded-card bg-surface p-4 text-sm shadow-card">
          <b className="mb-1 text-base">Қорытынды</b>
          <div className="flex justify-between"><span className="text-text-secondary">Менеджер</span><b>{managerName}</b></div>
          <div className="flex justify-between"><span className="text-text-secondary">Цена</span><b>{money(totals.price)}</b></div>
          <div className="flex justify-between"><span className="text-text-secondary">Продали за</span><b>{money(totals.sold)}</b></div>
          <div className="flex justify-between"><span className="text-text-secondary">Төленді</span><b className="text-[#15803d]">{money(totals.paid)}</b></div>
          <div className="flex justify-between"><span className="text-text-secondary">Қалдық</span><b className={totals.rest > 0 ? "text-danger" : ""}>{money(totals.rest)}</b></div>
        </div>
        {result && !result.ok && <p className="m-0 rounded-icon bg-danger/10 px-3 py-2 text-sm text-danger">{result.error}</p>}
        <button type="button" disabled={pending} onClick={submit} className="min-h-12 rounded-icon bg-[#1f4fe0] text-base font-bold text-white disabled:opacity-60">
          {pending ? "Сақталуда..." : "Заказды сақтау"}
        </button>
        <p className="m-0 text-xs text-text-secondary">
          Сақтағанда әр тауар Продажи кестесіне жол болып түседі: рейтинг, касса, цех өзі жаңарады.
        </p>
      </aside>
    </div>
  );
}
