"use client";

import { useEffect } from "react";

// Ең жоғарғы деңгейдегі қате (layout-тың өзі құлағанда) — ақ бет орнына хабар және «Қайта ашу».
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    const body = JSON.stringify({ kind: "global-error", message: error.message, digest: error.digest, stack: error.stack?.slice(0, 2000), url: location.pathname });
    navigator.sendBeacon?.("/api/client-error", body);
  }, [error]);
  return (
    <html lang="kk">
      <body style={{ fontFamily: "Arial, sans-serif", background: "#f5f6fa", display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: 32, maxWidth: 420, textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Бет ашылмай қалды</h2>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Бетті қайта ашыңыз — енгізілген деректер сақталған.</p>
          {error.digest && <p style={{ color: "#9ca3af", fontSize: 12 }}>Код: {error.digest}</p>}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: "#1f4fd8", color: "#fff", border: 0, borderRadius: 12, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}
          >
            Қайта ашу
          </button>
        </div>
      </body>
    </html>
  );
}
