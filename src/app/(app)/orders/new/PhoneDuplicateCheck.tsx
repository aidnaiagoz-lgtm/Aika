"use client";

import { useState } from "react";

// §26 — Duplicate Protection: телефон өрісінен шыққанда бар клиентті тексереді.
export function PhoneDuplicateCheck() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const phone = e.target.value.trim();
    if (phone.length < 6) {
      setMessage(null);
      return;
    }
    try {
      const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      setMessage(data.found ? `Бұл клиент базада бар: ${data.fullName}${data.isVip ? " (VIP)" : ""} — жоғарыдағы "Бар клиент" тізімінен таңдаңыз.` : null);
    } catch {
      setMessage(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        name="customerPhone"
        placeholder="+7 7__ ___ ____"
        onBlur={handleBlur}
        className="rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {message && <p className="text-xs font-medium text-status-shipping">{message}</p>}
    </div>
  );
}
