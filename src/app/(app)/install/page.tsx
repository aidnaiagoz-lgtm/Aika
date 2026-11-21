import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listInstallJobs } from "@/lib/domain/workshop";
import { carTitle } from "@/lib/domain/lekala/calc";
import { PushSetup } from "../workshop/PushSetup";
import { Elapsed } from "../orders/flow-ui";
import { PickUpButton } from "./PickUpButton";

const tm = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const dm = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Asia/Almaty" });
const ymd = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
const when = (d: Date) => (ymd(d) === ymd(new Date()) ? `бүгін · ${tm.format(d)}` : `${dm.format(d)} · ${tm.format(d)}`);

/** «5Д - Люкс - салон полный 2 ряд» → ["5Д Люкс", "салон полный 2 ряд"]; съёмный полик болса «+ съёмный полик» */
function chips(product: string | null, matType: string | null): string[] {
  const parts = (product ?? "").split(" - ").map((s) => s.trim()).filter((s) => s && s !== "-");
  const out: string[] = [];
  if (parts.length >= 3) out.push(`${parts[0]} ${parts[1]}`, ...parts.slice(2));
  else if (parts.length) out.push(...parts);
  if (matType) out.push("+ съёмный полик");
  return out;
}

type Job = Awaited<ReturnType<typeof listInstallJobs>>[number];

/**
 * Орнатушы (Расул, Берекет) — «Алып кету» (CEO, 2026-11-21, бекітілген макет): «Алу керек» / «Бүгін алдым»,
 * карточкалар (компьютерде 3 қатар), цехта қанша тұр, тауар белгілері. Клиенттің аты мен телефоны көрсетілмейді.
 */
export default async function InstallPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const jobs = await listInstallJobs(user).catch(() => null);
  if (!jobs) redirect("/");
  const tab = (await searchParams).tab === "done" ? "done" : "need";
  const need = jobs.filter((j) => !j.pickedUpAt);
  const done = jobs.filter((j) => j.pickedUpAt);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">Алып кету</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">Цехта дайын тұрған «установка» заказдары</p>
        </div>
        <PushSetup compact />
      </div>

      <div className="flex gap-2">
        <TabLink href="/install" on={tab === "need"} label="Алу керек" n={need.length} />
        <TabLink href="/install?tab=done" on={tab === "done"} label="Бүгін алдым" n={done.length} />
      </div>

      {tab === "need" && (
        <>
          {need.length === 0 ? (
            <p className="m-0 rounded-card border border-border bg-surface p-8 text-center text-sm text-text-secondary">Әзірге алып кететін заказ жоқ.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {need.map((j) => (
                <JobCard key={j.id} j={j} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <>
              <div className="mt-2 text-xs font-bold uppercase tracking-wide text-text-secondary">Бүгін алдым</div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {done.map((j) => (
                  <DoneCard key={j.id} j={j} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {tab === "done" &&
        (done.length === 0 ? (
          <p className="m-0 rounded-card border border-border bg-surface p-8 text-center text-sm text-text-secondary">Бүгін әлі ештеңе алынбады.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {done.map((j) => (
              <DoneCard key={j.id} j={j} />
            ))}
          </div>
        ))}
    </div>
  );
}

function TabLink({ href, on, label, n }: { href: string; on: boolean; label: string; n: number }) {
  return (
    <Link
      href={href}
      className={`rounded-pill border px-4 py-2 text-sm font-semibold ${on ? "border-text-primary bg-text-primary text-white" : "border-border bg-surface text-text-secondary"}`}
    >
      {label} <span className="ml-1 opacity-70">{n}</span>
    </Link>
  );
}

function CarName({ j, size }: { j: Job; size: "lg" | "md" }) {
  const ct = carTitle(j.car, j.brand);
  return (
    <div className={`font-extrabold tracking-tight text-text-primary ${size === "lg" ? "mt-2 text-xl" : "mt-1 text-base"}`}>
      {ct.title || "Көлік жазылмаған"}
      {j.carYear ? <span className="font-bold text-text-secondary"> {j.carYear}</span> : null}
    </div>
  );
}

function JobCard({ j }: { j: Job }) {
  const cs = chips(j.product, j.matType);
  return (
    <div className="flex flex-col rounded-[16px] border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>№{j.orderNo}</span>
        {j.doneAt && (
          <span className="font-semibold">
            цехта <Elapsed from={j.doneAt.toISOString()} />
          </span>
        )}
      </div>
      <CarName j={j} size="lg" />
      {cs.length > 0 && (
        <div className="mb-3 mt-2 flex flex-wrap gap-1.5">
          {cs.map((c) => (
            <span key={c} className="rounded-[7px] bg-page-bg px-2 py-1 text-xs font-semibold text-text-primary">
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex justify-between gap-2 border-t border-border pt-2.5 text-xs text-text-secondary">
        <span>
          Менеджер <b className="font-semibold text-text-primary">{j.manager || "—"}</b>
        </span>
        <span>дайын {j.doneAt ? when(j.doneAt) : "—"}</span>
      </div>
      <PickUpButton id={j.id} />
    </div>
  );
}

function DoneCard({ j }: { j: Job }) {
  return (
    <div className="flex flex-col rounded-[16px] border border-border bg-surface p-4 opacity-90">
      <div className="text-xs text-text-secondary">№{j.orderNo}</div>
      <CarName j={j} size="md" />
      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-[12px] bg-[#e7f7ec] py-2.5 text-sm font-bold text-[#15803d]">
        <Check size={16} strokeWidth={3} /> {j.pickedUpBy ?? "Орнатушы"} алды · {j.pickedUpAt ? tm.format(j.pickedUpAt) : ""}
      </div>
    </div>
  );
}
