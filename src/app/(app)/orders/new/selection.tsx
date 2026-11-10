"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * «Бар клиент» ↔ «Бар көлік» байланысы. Екі select әр түрлі карточкада тұр, сондықтан
 * таңдауды кішкене ортақ store арқылы бөлісеміз:
 *  - көлік тізімі тек таңдалған клиенттің көліктерін көрсетеді;
 *  - бар көлік таңдалса, «жаңа көлік» өрістері сөндіріледі (шатасып BMW жазып қоймас үшін).
 */
type State = { customerId: string; vehicleId: string };
let state: State = { customerId: "", vehicleId: "" };
const subs = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}
const useSelection = () => useSyncExternalStore(subscribe, () => state, () => state);

const selectClass =
  "rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60";

export function CustomerSelect({ customers, newLabel }: { customers: { id: string; label: string }[]; newLabel: string }) {
  useEffect(() => () => set({ customerId: "", vehicleId: "" }), []);
  return (
    <select
      name="customerId"
      className={selectClass}
      defaultValue=""
      onChange={(e) => set({ customerId: e.target.value, vehicleId: "" })}
    >
      <option value="">{newLabel}</option>
      {customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

export function VehicleSelect({
  vehicles,
  newLabel,
  noCustomerHint,
  noCarsHint,
}: {
  vehicles: { id: string; customerId: string; label: string }[];
  newLabel: string;
  noCustomerHint: string;
  noCarsHint: string;
}) {
  const { customerId, vehicleId } = useSelection();
  const own = customerId ? vehicles.filter((v) => v.customerId === customerId) : [];
  const hint = !customerId ? noCustomerHint : own.length === 0 ? noCarsHint : "";
  return (
    <div className="flex flex-col gap-1">
      <select
        name="vehicleId"
        className={selectClass}
        value={vehicleId}
        disabled={own.length === 0}
        onChange={(e) => set({ vehicleId: e.target.value })}
      >
        <option value="">{newLabel}</option>
        {own.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </div>
  );
}

/** Бар көлік таңдалса — ішіндегі «жаңа көлік» өрістері сөнеді (жіберілмейді). */
export function NewVehicleFields({ children }: { children: React.ReactNode }) {
  const { vehicleId } = useSelection();
  return (
    <fieldset disabled={!!vehicleId} className={`contents ${vehicleId ? "[&_input]:opacity-50 [&_select]:opacity-50" : ""}`}>
      {children}
    </fieldset>
  );
}
