"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sheetPushSetupAction, saveSheetPushUrlAction, disableSheetPushAction } from "./actions";

/** CEO: сайтта жазылған сатылым Google кестеге де түсуі үшін Apps Script қосу (бір рет). */
export function SheetPushSetup({ enabled, url }: { enabled: boolean; url: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [script, setScript] = useState<string | null>(null);
  const [u, setU] = useState(url ?? "");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadScript = () =>
    start(async () => {
      const r = await sheetPushSetupAction();
      if (!r.ok) return setMsg({ t: r.error, bad: true });
      setScript(r.data.script);
    });
  const copy = async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ t: "Көшіру сәтсіз — мәтінді белгілеп, Ctrl+C басыңыз", bad: true });
    }
  };
  const save = () =>
    start(async () => {
      const r = await saveSheetPushUrlAction(u);
      setMsg(r.ok ? { t: "Қосылды ✓ Енді сайтта жазылған сатылым Google кестеге де түседі." } : { t: r.error, bad: true });
      if (r.ok) router.refresh();
    });

  return (
    <section id="sheet-push" className="rounded-[20px] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text-primary">Сайттан Google кестеге</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${enabled ? "bg-[#e7f8ee] text-[#15803d]" : "bg-[#f0f1f4] text-[#5f6368]"}`}>
          {enabled ? "Қосулы" : "Қосылмаған"}
        </span>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Сайттағы «Продажи»-ге жазылған сатылым «продажи» парағының астына өзі қосылады. Рейтингте бір рет қана саналады: кестеге түскен көшірмесін
        сайт таниды. Формула бағандарына (№, Год, Мес, Цена, Остаток, Оплаты) тимейді.
      </p>

      {!enabled && (
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-text-primary">
          <li>
            <button onClick={loadScript} disabled={pending} className="rounded-lg border border-[#1f4fd8] px-3 py-1 text-sm font-semibold text-[#1f4fd8] hover:bg-[#e8efff]">
              Скриптті көрсету
            </button>{" "}
            {script && (
              <button onClick={copy} className="rounded-lg bg-[#1f4fd8] px-3 py-1 text-sm font-semibold text-white">
                {copied ? "Көшірілді ✓" : "Көшіру"}
              </button>
            )}
            {script && <textarea readOnly value={script} className="mt-2 h-40 w-full rounded-lg border border-border bg-page-bg p-2 font-mono text-[11px]" />}
          </li>
          <li>
            Google кестені ашыңыз → <b>Расширения → Apps Script</b> → ішіндегіні өшіріп, көшірген скриптті қойыңыз → <b>Сохранить</b>.
          </li>
          <li>
            <b>Развернуть → Новое развертывание</b> → түрі: <b>Веб-приложение</b> → «Выполнять как»: <b>Я</b>, «Доступ»: <b>Все</b> → <b>Развернуть</b> → рұқсат беріңіз.
          </li>
          <li>
            Шыққан <b>URL-ді</b> (…/exec) осы жерге қойып, «Тексеріп қосу» басыңыз:
            <div className="mt-2 flex flex-wrap gap-2">
              <input value={u} onChange={(e) => setU(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className="min-w-[280px] flex-1 rounded-lg border border-border px-3 py-1.5 text-sm" />
              <button onClick={save} disabled={pending || !u} className="rounded-lg bg-[#1f4fd8] px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">
                {pending ? "Тексеріп жатыр…" : "Тексеріп қосу"}
              </button>
            </div>
          </li>
        </ol>
      )}
      {enabled && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-secondary">URL: {url}</span>
          <button
            onClick={() =>
              start(async () => {
                await disableSheetPushAction();
                router.refresh();
              })
            }
            className="text-xs text-text-secondary underline"
          >
            Өшіру
          </button>
        </div>
      )}
      {msg && <p className={`mt-3 rounded-xl px-3.5 py-2.5 text-sm ${msg.bad ? "bg-danger/10 text-danger" : "bg-[#e7f8ee] text-[#15803d]"}`}>{msg.t}</p>}
    </section>
  );
}
