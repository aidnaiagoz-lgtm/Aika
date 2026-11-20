import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CarFront, Check, Inbox, Scissors, Handshake } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { canUseWorkshop } from "@/lib/access";
import { getJobDetail, listWorkers, missingForDone } from "@/lib/domain/workshop";
import { jobHeadline, leatherNorm, splitMaterial, swatchColor } from "@/lib/domain/workshop/calc";
import { carTitle } from "@/lib/domain/lekala/calc";
import { Elapsed } from "../../../orders/flow-ui";
import { DoneActions, LekalaBox, RegistryForm, StartAction } from "./JobActions";
import { PhotoZoom } from "../../../warehouse/PhotoZoom";
import { AddPhotoButton } from "./AddPhotoButton";

export const dynamic = "force-dynamic";

/**
 * Цех: заказдың жеке беті (CEO, 2026-11-17 — «Каспий магазиндегідей»). Үстінде — нөмір, күйі, таймер; қадамдар;
 * сол жақта — реестр (Бекзат толтырады), заказ құрамы, материалдар, алу/ескертпе; оң жақта — әрекет, менеджер, тарих.
 * Клиенттің аты мен телефоны мұнда көрсетілмейді.
 */

const dt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const tm = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const fmt = (d: Date | null) => (d ? dt.format(d).replace(",", " ·") : null);

const STATUS = {
  NEW: { label: "Жаңа", cls: "bg-[#fff4e0] text-[#b45309]", list: "Түскен заказдар", href: "/workshop/incoming" },
  IN_PROGRESS: { label: "Тігіліп жатыр", cls: "bg-[#eef2ff] text-[#3b4b9c]", list: "Тігіліп жатыр", href: "/workshop/sewing" },
  DONE: { label: "Дайын", cls: "bg-[#e7f7ec] text-[#15803d]", list: "Дайын", href: "/workshop/ready" },
  CANCELLED: { label: "Алынып тасталды", cls: "bg-page-bg text-text-secondary", list: "Түскен заказдар", href: "/workshop/incoming" },
} as const;

function durationText(from: Date | null, to: Date | null) {
  if (!from || !to) return "—";
  const min = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} сағ ${String(min % 60).padStart(2, "0")} мин` : `${min} мин`;
}

/** «Кармашки лого»: Google-да true/false, «да», мәтін болуы мүмкін. */
function logoChip(v: string | null) {
  const s = (v ?? "").trim();
  if (!s || /^(false|нет|жоқ|-|0)$/i.test(s)) return null;
  return /^(true|да|иә|бар|1)$/i.test(s) ? "Лого" : `Лого: ${s}`;
}

function Material({ label, raw, photos, ids }: { label: string; raw: string | null; photos: Record<string, string>; ids?: Record<string, string> }) {
  const m = splitMaterial(raw);
  if (!m) return null;
  const color = swatchColor(m.name);
  const photo = m.code ? photos[m.code] : undefined;
  const addId = !photo && m.code && ids ? ids[m.code] : undefined;
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-border px-3.5 py-3">
      {photo ? (
        <PhotoZoom src={photo} alt={m.name} size={48} />
      ) : addId ? (
        <AddPhotoButton materialId={addId} />
      ) : (
      <span
        className="h-10 w-10 shrink-0 rounded-[10px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
        style={{
          background: color
            ? `repeating-linear-gradient(45deg, ${color} 0 6px, color-mix(in srgb, ${color} 85%, white) 6px 7px)`
            : "repeating-linear-gradient(45deg,#eceef4 0 6px,#f6f7fb 6px 7px)",
        }}
      />
      )}
      <div className="min-w-0">
        <div className="text-xs font-semibold text-text-secondary">{label}</div>
        <div className="truncate font-bold text-text-primary">{m.name}</div>
        {m.code && <div className="text-xs text-text-secondary">№{m.code}</div>}
      </div>
    </div>
  );
}

function Step({ icon: Icon, title, at, state }: { icon: typeof Inbox; title: string; at: string; state: "done" | "cur" | "off" }) {
  return (
    <div className="flex w-[68px] shrink-0 flex-col items-center text-center md:w-[140px]">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          state === "done" ? "bg-accent text-white" : state === "cur" ? "border-2 border-dashed border-accent bg-surface text-accent" : "bg-page-bg text-text-secondary/60"
        }`}
      >
        <Icon size={18} />
      </span>
      <span className="mt-2 text-[13px] font-bold text-text-primary">{title}</span>
      <span className="text-xs text-text-secondary">{at}</span>
    </div>
  );
}

const Line = ({ on }: { on: boolean }) => <span className={`mt-5 h-[3px] flex-1 rounded ${on ? "bg-accent" : "bg-border"}`} />;

function CarCell({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col justify-center border-r border-border px-3 py-2 last:border-r-0 md:px-4">
      <span className="text-[10px] font-bold uppercase tracking-wide md:text-[11px] text-text-secondary">{label}</span>
      <span className={`break-words font-extrabold leading-tight ${big ? "text-[22px] md:text-[30px]" : "text-[16px] md:text-[22px]"}`}>{value}</span>
    </span>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-extrabold text-text-primary">{title}</h2>
        {aside && <span className="text-xs font-semibold text-text-secondary">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canUseWorkshop(user)) redirect("/dashboard");
  const { id } = await params;
  const detail = await getJobDetail(user, id);
  if (!detail) notFound();
  const { job } = detail;
  const workers = (await listWorkers(user)).map((w) => w.name);

  const st = STATUS[job.status];
  // Көлік — беттегі ең көрнекі жазу (CEO, 2026-11-20): «Hyundai Stariya» + жылы
  const ct = carTitle(job.car, job.brand);
  const car = ct.title ? `${ct.title}${job.carYear ? ` · ${job.carYear}` : ""}` : jobHeadline({ car: job.car, brand: job.brand, carYear: job.carYear });
  const leather = splitMaterial(job.leatherType);
  const leatherColor = swatchColor(leather?.name) ?? "#2a2a2a";
  const threadColor = swatchColor(splitMaterial(job.leatherPipingThread ?? job.leatherThread)?.name) ?? "#b91c1c";
  const pockets = job.pocketsPairs == null ? 0 : Number(job.pocketsPairs);
  const chips = [
    pockets > 0 ? `Кармашки · ${pockets} жұп` : null,
    logoChip(detail.pocketsLogo),
    job.matType ? "Съёмный полик" : null,
  ].filter(Boolean) as string[];

  const timer =
    job.status === "NEW"
      ? { label: "Кезекте тұр", node: <Elapsed from={job.receivedAt.toISOString()} /> }
      : job.status === "IN_PROGRESS"
        ? { label: "Тігіліп жатыр", node: job.startedAt ? <Elapsed from={job.startedAt.toISOString()} /> : <span>—</span> }
        : job.status === "DONE"
          ? { label: "Тігілді", node: <span className="text-[#15803d]">{durationText(job.startedAt, job.doneAt)}</span> }
          : null;

  const missing = job.status === "IN_PROGRESS" ? missingForDone(job) : [];
  const handedText = job.handedAt ? (job.handedBy?.startsWith("Архив") ? "архивке жабылды" : tm.format(job.handedAt)) : "—";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3.5">
      <nav className="text-[13px] text-text-secondary">
        <Link href="/workshop/incoming" className="font-semibold text-accent">
          Цех
        </Link>{" "}
        ›{" "}
        <Link href={st.href} className="font-semibold text-accent">
          {st.list}
        </Link>{" "}
        › №{job.orderNo}
      </nav>

      {/* Тақырып */}
      <header className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-text-secondary">
            Заказ №{job.orderNo}
            <span className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>● {st.label}</span>
          </div>
          {/* Көлік — марка / модель / жыл бөлек ұяшықтарда, алыстан оқылатындай */}
          <h1 className="m-0 mt-1 flex w-fit max-w-full items-stretch overflow-hidden rounded-[12px] border border-border bg-surface text-text-primary">
            {ct.make ? (
              <>
                <CarCell label="Марка" value={ct.make} />
                <CarCell label="Модель" value={ct.model} big />
              </>
            ) : (
              <CarCell label="Көлік" value={ct.title || "жазылмаған"} big />
            )}
            <CarCell label="Жылы" value={job.carYear ? String(job.carYear) : "—"} />
          </h1>
          {ct.title && ct.raw && ct.raw.toLowerCase() !== ct.title.toLowerCase() && (
            <span className="text-xs text-text-secondary">менеджер жазғаны: {ct.raw}</span>
          )}
          <p className="m-0 text-[13px] text-text-secondary">
            Түсті <b className="font-semibold text-text-primary">{fmt(job.receivedAt)}</b>
            {job.manager && (
              <>
                {" "}
                · Менеджер <b className="font-semibold text-text-primary">{job.manager}</b>
              </>
            )}
            {detail.pickup && (
              <>
                {" "}
                · Алып кету <b className="font-semibold text-text-primary">{detail.pickup}</b>
              </>
            )}
          </p>
        </div>
        {timer && (
          <div className="flex flex-col md:items-end">
            <span className="text-xs text-text-secondary">{timer.label}</span>
            <span className="text-[26px] font-extrabold leading-tight">{timer.node}</span>
            <span className="text-xs text-text-secondary">норма — 1–2 сағатта дайын</span>
          </div>
        )}
      </header>

      {/* Қадамдар */}
      <div className="flex items-start overflow-x-auto rounded-card bg-surface px-4 py-4 shadow-card md:px-7">
        <Step icon={Inbox} title="Цехқа түсті" at={tm.format(job.receivedAt)} state="done" />
        <Line on={!!job.startedAt} />
        <Step
          icon={Scissors}
          title="Тігу"
          at={job.startedAt ? tm.format(job.startedAt) : "күтіп тұр"}
          state={job.startedAt ? "done" : job.status === "NEW" ? "cur" : "off"}
        />
        <Line on={!!job.doneAt} />
        <Step icon={Check} title="Дайын" at={job.doneAt ? tm.format(job.doneAt) : "—"} state={job.doneAt ? "done" : job.status === "IN_PROGRESS" ? "cur" : "off"} />
        <Line on={!!job.handedAt} />
        <Step icon={Handshake} title="Берілді" at={handedText} state={job.handedAt ? "done" : job.status === "DONE" ? "cur" : "off"} />
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {(job.status === "IN_PROGRESS" || job.status === "DONE") && (
            <RegistryForm
              job={{
                id: job.id,
                done: job.status === "DONE",
                leatherName: leather ? `${leather.code ? leather.code + " · " : ""}${leather.name}` : null,
                matName: splitMaterial(job.matType)?.name ?? null,
                leatherMeters: job.leatherMeters == null ? null : Number(job.leatherMeters),
                leatherOwner: job.leatherOwner,
                matMeters: job.matMeters == null ? null : Number(job.matMeters),
                matOwner: job.matOwner,
                norm: leatherNorm(job.product),
                cutBy: job.cutBy,
                joinBy: job.joinBy,
                edgeBy: job.edgeBy,
                bottomBy: job.bottomBy,
              }}
              workers={workers}
            />
          )}

          <Section title="Заказ құрамы" aside="1 тауар">
            <div className="flex items-center gap-4 border-b border-border/70 pb-4">
              <div
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[14px]"
                style={{ background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${leatherColor} 80%, white), ${leatherColor})` }}
              >
                <span
                  className="absolute inset-0"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg,transparent 0 10px,rgba(255,255,255,.07) 10px 11px),repeating-linear-gradient(-45deg,transparent 0 10px,rgba(255,255,255,.07) 10px 11px)",
                  }}
                />
                <span className="absolute inset-3.5 rounded-[10px] border-2 border-dashed opacity-90" style={{ borderColor: threadColor }} />
                {leather?.code && detail.photos[leather.code] && (
                  <span className="absolute inset-0">
                    <PhotoZoom src={detail.photos[leather.code]} alt={leather.name} size={96} rounded={14} />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-extrabold leading-snug text-text-primary">{job.product?.trim() || "Тауар жазылмаған"}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[15px] font-bold text-text-primary">
                  <CarFront size={16} className="text-accent" />
                  {car || "Көлік жазылмаған"}
                </div>
                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <span key={c} className="rounded-[8px] bg-page-bg px-2.5 py-1 text-xs font-semibold text-text-primary">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <h3 className="mb-2.5 mt-4 text-sm font-extrabold text-text-primary">Материалдар</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Material photos={detail.photos} ids={detail.materialIds} label="Кожа" raw={job.leatherType} />
              <Material photos={detail.photos} ids={detail.materialIds} label="Стыковка жібі" raw={job.leatherThread} />
              <Material photos={detail.photos} ids={detail.materialIds} label="Лента (окантовка)" raw={job.leatherPiping} />
              <Material photos={detail.photos} ids={detail.materialIds} label="Окантовка жібі" raw={job.leatherPipingThread} />
              <Material photos={detail.photos} ids={detail.materialIds} label="Съёмный полик" raw={job.matType} />
              <Material photos={detail.photos} ids={detail.materialIds} label="Съёмный · жіп" raw={job.matThread} />
              <Material photos={detail.photos} ids={detail.materialIds} label="Съёмный · окантовка" raw={job.matPiping} />
            </div>
            {!job.leatherType && !job.matType && <p className="m-0 text-sm text-text-secondary">Материал жазылмаған — менеджерден сұраңыз.</p>}
          </Section>

          <Section title="Алу және ескертпе">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-[14px] bg-page-bg px-3.5 py-3">
                <div className="text-xs font-semibold text-text-secondary">Алып кету</div>
                <div className="mt-1 font-bold text-text-primary">{detail.pickup ?? "—"}</div>
              </div>
              <div className="rounded-[14px] bg-page-bg px-3.5 py-3">
                <div className="text-xs font-semibold text-text-secondary">Мерзімі</div>
                <div className="mt-1 font-bold text-text-primary">{fmt(detail.deadline) ?? "—"}</div>
              </div>
            </div>
            {detail.comment && (
              <div className="mt-2.5 rounded-[14px] border border-[#fde68a] bg-[#fffbeb] px-3.5 py-3 text-sm text-text-primary">
                <div className="mb-0.5 text-xs font-bold text-[#a16207]">Менеджердің түсініктемесі</div>
                {detail.comment}
              </div>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-3.5 lg:sticky lg:top-0">
          <Section title="Әрекет">
            {job.status === "NEW" && <StartAction id={job.id} manager={job.manager} />}
            {(job.status === "IN_PROGRESS" || job.status === "DONE") && (
              <DoneActions key={missing.join("|")} id={job.id} status={job.status} missing={missing} doneAt={fmt(job.doneAt)} handed={!!job.handedAt} />
            )}
            {job.status === "CANCELLED" && <p className="m-0 text-sm text-text-secondary">Менеджер «Цех» белгісін алып тастады — тігудің қажеті жоқ.</p>}
            {job.status !== "CANCELLED" && <LekalaBox id={job.id} note={job.lekalaNote} />}
          </Section>

          <Section title="Менеджер">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint text-[17px] font-extrabold text-accent">
                {(job.manager ?? "?").trim().charAt(0).toUpperCase()}
              </span>
              <div>
                <div className="font-bold text-text-primary">{job.manager ?? "—"}</div>
                <div className="text-xs text-text-secondary">Сатушы · хабарлар осы кісіге барады</div>
              </div>
            </div>
            <p className="mb-0 mt-3 text-xs text-text-secondary">Клиенттің аты мен телефоны цехқа көрсетілмейді.</p>
          </Section>

          <Section title="Тарих">
            <ol className="m-0 ml-1.5 list-none border-l-2 border-border p-0 pl-4">
              {[
                { t: "Цехқа түсті", at: fmt(job.receivedAt) },
                { t: "Тігу басталды", at: fmt(job.startedAt) },
                { t: "Дайын", at: fmt(job.doneAt) },
                { t: "Клиентке берілді", at: job.handedAt ? `${fmt(job.handedAt)}${job.handedBy ? " · " + job.handedBy : ""}` : null },
              ].map((h, i, a) => (
                <li key={h.t} className={`relative ${i < a.length - 1 ? "pb-3.5" : ""}`}>
                  <span className={`absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full ${h.at ? "bg-accent" : "bg-border"}`} />
                  <div className="text-[13px] font-bold text-text-primary">{h.t}</div>
                  <div className="text-xs text-text-secondary">{h.at ?? "—"}</div>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </div>
  );
}
