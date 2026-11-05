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
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
