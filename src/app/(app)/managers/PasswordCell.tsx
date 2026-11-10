"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { revealPasswordAction, setPasswordAction } from "./actions";

/** CEO үшін: менеджердің қазіргі паролін көру және өзі пароль қою. */
export function PasswordCell({ userId, hasCopy }: { userId: string; hasCopy: boolean }) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);

  const reveal = () =>
    start(async () => {
      setMsg(null);
      const r = await revealPasswordAction(userId);
      if (!r.ok) return setMsg({ t: r.error, bad: true });
      if (!r.password) return setMsg({ t: "Әзірге белгісіз — менеджер келесі рет кіргенде өзі жазылады, не өзіңіз пароль қойыңыз", bad: true });
      setShown(r.password);
    });
  const save = () =>
    start(async () => {
      const r = await setPasswordAction(userId, value);
      if (!r.ok) return setMsg({ t: r.error, bad: true });
      setShown(value);
      setEditing(false);
      setValue("");
      setMsg({ t: "Пароль қойылды ✓ Менеджер осы парольмен кіреді" });
    });

  return (
    <div className="flex min-w-[170px] flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {shown ? (
          <>
            <b className="select-all font-mono text-text-primary">{shown}</b>
            <button onClick={() => setShown(null)} title="Жасыру" className="text-text-secondary hover:text-text-primary">
              <EyeOff size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={reveal}
            disabled={pending}
            className="flex items-center gap-1 rounded-pill border border-border px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-page-bg disabled:opacity-60"
          >
            <Eye size={13} /> {hasCopy ? "Көрсету" : "белгісіз"}
          </button>
        )}
        <button onClick={() => setEditing(!editing)} title="Пароль қою" className="ml-1 text-text-secondary hover:text-[#1f4fd8]">
          <Pencil size={13} />
        </button>
      </div>
      {editing && (
        <div className="flex gap-1">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="жаңа пароль (≥ 6)"
            className="w-32 rounded-md border border-border bg-page-bg px-2 py-1 font-mono text-xs"
          />
          <button onClick={save} disabled={pending || value.trim().length < 6} className="rounded-md bg-[#1f4fd8] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
            Қою
          </button>
        </div>
      )}
      {msg && <span className={`text-[11px] ${msg.bad ? "text-[#b7791f]" : "text-[#15803d]"}`}>{msg.t}</span>}
    </div>
  );
}
