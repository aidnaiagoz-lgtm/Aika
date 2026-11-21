import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listInstallJobs } from "@/lib/domain/workshop";
import { carTitle } from "@/lib/domain/lekala/calc";
import { PushSetup } from "../workshop/PushSetup";
import { PickUpButton } from "./PickUpButton";

const tm = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const dayTm = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const when = (d: Date) => (Date.now() - d.getTime() < 18 * 3600_000 ? tm.format(d) : dayTm.format(d));

/**
 * Орнатушы (Расул, Берекет) — «Алып кету» (CEO, 2026-11-21): цехта дайын тұрған «установка» заказдары.
 * «Алып кеттім» → менеджерге хабар. Клиенттің аты мен телефоны көрсетілмейді.
 */
export default async function InstallPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const jobs = await listInstallJobs(user).catch(() => null);
  if (!jobs) redirect("/");
  const waiting = jobs.filter((j) => !j.pickedUpAt).length;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3">
      <div>
        <h1 className="m-0 text-2xl font-bold text-text-primary">
          Алып кету {waiting > 0 && <span className="text-text-secondary">· {waiting}</span>}
        </h1>
        <p className="m-0 mt-1 text-sm text-text-secondary">Цехта дайын тұрған заказдар (установка)</p>
      </div>
      <PushSetup />
      {jobs.length === 0 && (
        <p className="m-0 rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">Әзірге алып кететін заказ жоқ.</p>
      )}
      {jobs.map((j) => {
        const ct = carTitle(j.car, j.brand);
        return (
          <div key={j.id} className={`rounded-card border border-border bg-surface p-4 ${j.pickedUpAt ? "opacity-80" : ""}`}>
            <div className="text-xs text-text-secondary">
              №{j.orderNo} · дайын {j.doneAt ? when(j.doneAt) : "—"}
            </div>
            <div className="mt-0.5 text-lg font-bold text-text-primary">
              {ct.title || "Көлік жазылмаған"}
              {j.carYear ? ` ${j.carYear}` : ""}
            </div>
            <div className="mt-0.5 text-sm text-text-secondary">{j.product || "—"}</div>
            {j.manager && <div className="text-sm text-text-secondary">Менеджер: {j.manager}</div>}
            {j.pickedUpAt ? (
              <div className="mt-3 flex items-center justify-center gap-1.5 rounded-[12px] bg-[#e7f7ec] py-2.5 text-sm font-bold text-[#15803d]">
                <Check size={16} strokeWidth={3} /> {j.pickedUpBy ?? "Орнатушы"} алды · {when(j.pickedUpAt)}
              </div>
            ) : (
              <PickUpButton id={j.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}
