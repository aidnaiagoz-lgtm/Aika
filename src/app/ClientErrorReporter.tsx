"use client";

import { useEffect } from "react";

/** Браузердегі қателерді серверге жібереді (Vercel логында «[client-error]» деп көрінеді). */
export function ClientErrorReporter() {
  useEffect(() => {
    const send = (kind: string, message: string, stack?: string) => {
      try {
        const body = JSON.stringify({ kind, message, stack: stack?.slice(0, 2000), url: location.pathname + location.search, ua: navigator.userAgent });
        navigator.sendBeacon?.("/api/client-error", body) || fetch("/api/client-error", { method: "POST", body, keepalive: true });
      } catch {
        /* елемейміз */
      }
    };
    const onError = (e: ErrorEvent) => send("error", e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send("unhandledrejection", r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
    };
    // Ақ бет бақылаушысы: бетте мәтін жоқ болып қалса — DOM мен жылжу күйін логқа жібереміз (бір рет)
    let blankSent = false;
    const watchdog = window.setInterval(() => {
      if (blankSent || location.pathname.startsWith("/login")) return;
      const text = document.body?.innerText?.trim() ?? "";
      if (text.length >= 30) return;
      blankSent = true;
      const scrolled = [document.scrollingElement, ...Array.from(document.querySelectorAll("body *"))]
        .filter((el): el is Element => !!el && (el.scrollTop > 0 || el.scrollLeft > 0))
        .slice(0, 10)
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)} ${el.scrollTop}/${el.scrollLeft}`);
      send("blank-page", `text=${text.length} html=${document.body?.innerHTML.length ?? 0} scrolled=${JSON.stringify(scrolled)}`, document.body?.innerHTML.slice(0, 1500));
    }, 3000);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.clearInterval(watchdog);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
