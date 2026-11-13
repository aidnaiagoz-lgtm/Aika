"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Share } from "lucide-react";
import { getPushKeyAction, subscribePushAction, testPushAction, unsubscribePushAction } from "./push-actions";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Цех бетінің үстінде: телефонға хабарламаны қосу. iPhone-да — алдымен «На экран «Домой»». */
export function PushSetup() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isStandalone() ? "install" : "unsupported");
      if (isIos() && !isStandalone()) return setState("install");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Сервер жазылымды білмей қалса (мыс. қайта кіргенде) — қайта сақтаймыз
        await subscribePushAction(sub.toJSON() as never);
        setState("on");
      } else setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const key = await getPushKeyAction();
      if (!key) throw new Error("Рұқсат жоқ");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      const r = await subscribePushAction(sub.toJSON() as never);
      if (!r.ok) throw new Error(r.error);
      setState("on");
      setMsg("Хабарлама қосылды ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Қосылмады");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await unsubscribePushAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const r = await testPushAction();
    setMsg(r.ok ? "Сынақ хабар жіберілді — телефонды қараңыз" : "Жіберілмеді: хабарламаны өшіріп-қосып көріңіз");
    setBusy(false);
  }

  if (state === "loading" || state === "unsupported") return null;

  const box = "flex flex-col gap-2 rounded-card p-4 shadow-card";
  if (state === "install") {
    return (
      <div className={`${box} bg-[#eef2ff]`}>
        <b className="text-[15px] text-text-primary">Телефонға хабарлама келуі үшін</b>
        <ol className="m-0 flex flex-col gap-1 pl-5 text-sm text-text-primary">
          <li>
            Сайтты <b>Safari</b> арқылы ашыңыз, төмендегі <Share size={14} className="inline align-[-2px]" /> <b>«Поделиться»</b> басыңыз.
          </li>
          <li>
            <b>«На экран «Домой»»</b> → <b>«Добавить»</b>.
          </li>
          <li>Экрандағы <b>AutoMax</b> белгішесімен кіріп, «Хабарламаларды қосу» басыңыз.</li>
        </ol>
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div className={`${box} bg-[#fff4e0]`}>
        <b className="text-[15px] text-[#b45309]">Хабарламаға рұқсат берілмеген</b>
        <span className="text-sm text-text-primary">
          iPhone: <b>Настройки → Уведомления → AutoMax</b> → «Допуск уведомлений» қосыңыз, сосын бетті қайта ашыңыз.
        </span>
      </div>
    );
  }
  if (state === "off") {
    return (
      <div className={`${box} bg-surface`}>
        <span className="text-sm text-text-secondary">Жаңа тапсырма түскенде телефонға хабар келсін бе?</span>
        <button
          type="button"
          disabled={busy}
          onClick={enable}
          className="flex min-h-12 items-center justify-center gap-2 rounded-icon bg-accent text-[15px] font-bold text-white disabled:opacity-60"
        >
          <Bell size={18} /> Хабарламаларды қосу
        </button>
        {msg && <span className="text-sm text-danger">{msg}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card bg-[#e7f7ec] px-4 py-3">
      <Bell size={16} className="text-[#15803d]" />
      <span className="text-sm font-semibold text-[#15803d]">Хабарлама қосулы</span>
      <button type="button" disabled={busy} onClick={test} className="ml-auto min-h-10 rounded-icon border border-[#bfe5cb] bg-surface px-3 text-sm font-semibold">
        Тексеру
      </button>
      <button type="button" disabled={busy} onClick={disable} aria-label="Хабарламаны өшіру" className="min-h-10 rounded-icon border border-[#bfe5cb] bg-surface px-3 text-text-secondary">
        <BellOff size={16} />
      </button>
      {msg && <span className="w-full text-sm text-text-primary">{msg}</span>}
    </div>
  );
}
