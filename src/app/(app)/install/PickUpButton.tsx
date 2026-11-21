"use client";

import { useState, useTransition } from "react";
import { pickUpAction } from "./actions";

export function PickUpButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await pickUpAction(id);
            setError(r.ok ? null : r.error);
          })
        }
        className="block w-full rounded-[12px] bg-accent py-3 text-center text-[15px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Белгіленуде…" : "Алып кеттім"}
      </button>
      {error && <div className="mt-1 text-xs text-danger">{error}</div>}
    </div>
  );
}
