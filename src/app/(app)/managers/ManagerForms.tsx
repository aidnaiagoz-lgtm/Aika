"use client";

import { useActionState } from "react";
import { createManagerAction, resetPasswordAction, type CredentialState } from "./actions";

const inputCls =
  "rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-[#1f4fd8]/30";

function CredentialBox({ state }: { state: CredentialState }) {
  if (!state) return null;
  if (!state.ok) return <p className="rounded-icon bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{state.error}</p>;
  return (
    <div className="rounded-card border-2 border-dashed border-[#1f4fd8] bg-[#e8efff] p-4 text-sm text-text-primary">
      <div className="font-semibold">
        {state.kind === "created" ? "✅ Аккаунт ашылды" : "🔁 Жаңа уақытша пароль"} — {state.fullName}
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <span className="text-text-secondary">Логин:</span>
        <b className="font-mono">{state.login}</b>
        <span className="text-text-secondary">Уақытша пароль:</span>
        <b className="font-mono text-base">{state.tempPassword}</b>
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        Осы мәліметті менеджерге жеке беріңіз. Бұл пароль қайта көрсетілмейді — бірінші кіргенде менеджер өз паролін қояды.
      </p>
    </div>
  );
}

export function CreateManagerForm() {
  const [state, action, pending] = useActionState(createManagerAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Аты (Excel-дегідей, мыс. «Жанерке 2»)
          <input name="fullName" required className={inputCls} placeholder="Зере" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Телефон (міндетті емес)
          <input name="phone" className={inputCls} placeholder="8 701 123 45 67" inputMode="tel" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Логин аттан автоматты жасалады
          <input disabled className={inputCls} placeholder="мыс. Зере → zere" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input type="checkbox" name="senior" className="h-4 w-4" /> Аға менеджер
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-[#1f4fd8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a43b8] disabled:opacity-60"
        >
          {pending ? "Ашылуда..." : "＋ Аккаунт ашу"}
        </button>
      </div>
      <CredentialBox state={state} />
    </form>
  );
}

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-page-bg disabled:opacity-60"
        >
          🔁 Жаңа пароль
        </button>
      </form>
      {state && (
        <div className="w-72 text-left">
          <CredentialBox state={state} />
        </div>
      )}
    </div>
  );
}

/** Қате басып қалмау үшін растау сұрайтын батырма (архив / толық өшіру). */
export function ConfirmButton({
  action,
  fields,
  label,
  confirmText,
  danger = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: string;
  confirmText: string;
  danger?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        className={`rounded-pill border px-3 py-1.5 text-xs font-semibold hover:bg-page-bg ${
          danger ? "border-danger/40 bg-surface text-danger" : "border-border bg-surface text-text-primary"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
