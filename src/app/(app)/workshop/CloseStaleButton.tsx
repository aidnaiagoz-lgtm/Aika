"use client";

import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
import { closeStaleJobsAction } from "./actions";

/** CEO: бүгінге дейін түсіп, батырмасы басылмай қалған ескі тапсырмаларды жабу (ештеңе өшірілмейді). */
export function CloseStaleButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 rounded-card border border-[#fde68a] bg-[#fffbeb] p-4 md:flex-row md:items-center">
      <div className="flex-1 text-sm text-text-primary">
        <b>{count} ескі заказ</b> бүгінге дейін түскен, бірақ «Тігуді бастау» / «Дайын» басылмаған. Олар іс жүзінде тігіліп кеткен болса —
        жабыңыз: тізімнен шығады, айлыққа кірмейді, ештеңе өшірілмейді.
        {error && <div className="mt-1 font-semibold text-danger">{error}</div>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`${count} ескі заказды жабамыз ба? (Бүгін түскендері қалады)`)) return;
          start(async () => {
            const r = await closeStaleJobsAction();
            setError(r.ok ? null : r.error);
          });
        }}
        className="flex min-h-11 items-center justify-center gap-2 rounded-icon bg-[#0b1a45] px-4 text-sm font-bold text-white disabled:opacity-60"
      >
        <Archive size={16} /> {pending ? "Жабылуда…" : "Ескілерін жабу"}
      </button>
    </div>
  );
}
