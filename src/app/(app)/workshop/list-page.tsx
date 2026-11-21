import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canOpenWorkshop, isLeader } from "@/lib/access";
import { listJobs, staleJobCount, syncWorkshopJobs, workshopActiveSince } from "@/lib/domain/workshop";
import { jobHeadline, splitMaterial } from "@/lib/domain/workshop/calc";
import { carTitle } from "@/lib/domain/lekala/calc";
import { ActivateButton } from "./ActivateButton";
import { PushSetup } from "./PushSetup";
import { JobList, type ListJob, type ListView } from "./JobList";
import { CloseStaleButton } from "./CloseStaleButton";

/**
 * Цех тізімдері (CEO, 2026-11-17): «Түскен заказдар» · «Тігіліп жатыр» · «Дайын» — сол жақ мәзірдегі «Цех ▾» ішінде.
 * № басса — заказдың жеке беті (/workshop/job/[id]).
 */

const META: Record<ListView, { title: string; sub: string; empty: string; view: "new" | "work" | "done"; path: string }> = {
  incoming: {
    title: "Түскен заказдар",
    sub: "Цехқа түскен, әлі басталмаған заказдар. Тігуді бастағанда батырманы басыңыз — менеджерге хабар барады.",
    empty: "Жаңа заказ жоқ. Менеджер «Цехқа жіберілді» деп белгілесе, осында бірден шығады.",
    view: "new",
    path: "/workshop/incoming",
  },
  sewing: {
    title: "Тігіліп жатыр",
    sub: "Қазір цехта. Норма — 1–2 сағат, 2 сағаттан асса уақыт қызыл болады.",
    empty: "Қазір тігіліп жатқан заказ жоқ.",
    view: "work",
    path: "/workshop/sewing",
  },
  ready: {
    title: "Дайын",
    sub: "Соңғы 14 күнде дайын болған заказдар.",
    empty: "Соңғы 14 күнде дайын болған заказ жоқ.",
    view: "done",
    path: "/workshop/ready",
  },
};

export async function WorkshopListPage({ list, q: rawQ }: { list: ListView; q?: string }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canOpenWorkshop(user)) redirect("/dashboard");

  const since = await workshopActiveSince();
  if (!since) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="m-0 text-2xl font-bold text-text-primary">Цех</h1>
        <div className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-card">
          <p className="m-0 text-[15px] text-text-primary">
            Цех жүйесі әлі іске қосылмаған. Іске қосылған күннен бастап «Цех ✓» қойылған әр сатылым цехқа түседі, Бекзатқа хабар барады.
          </p>
          {isLeader(user) ? <ActivateButton /> : <p className="m-0 text-sm text-text-secondary">Іске қосуды CEO жасайды.</p>}
        </div>
      </div>
    );
  }

  // Google-дан келген соңғы өзгерістерді тапсырмаларға көшіру (2 минуттық синхрондауды күтпей)
  await syncWorkshopJobs(undefined, { recentDays: 3 }).catch((e) => console.error("[workshop] sync", e instanceof Error ? e.message : e));

  const meta = META[list];
  const q = (rawQ ?? "").trim().slice(0, 60);
  const jobs = await listJobs(user, meta.view, q);
  const stale = list !== "ready" && isLeader(user) ? await staleJobCount() : 0;

  const rows: ListJob[] = jobs.map((j) => ({
    id: j.id,
    orderNo: j.orderNo,
    status: j.status,
    receivedAt: j.receivedAt.toISOString(),
    startedAt: j.startedAt?.toISOString() ?? null,
    doneAt: j.doneAt?.toISOString() ?? null,
    handedAt: j.handedAt?.toISOString() ?? null,
    manager: j.manager,
    car: (() => {
      const t = carTitle(j.car, j.brand).title;
      return t ? `${t}${j.carYear ? ` ${j.carYear}` : ""}` : jobHeadline({ car: j.car, brand: j.brand, carYear: j.carYear });
    })(),
    product: j.product?.trim() || null,
    leather: splitMaterial(j.leatherType)?.name ?? null,
    leatherMeters: j.leatherMeters == null ? null : Number(j.leatherMeters),
    lekalaNote: j.lekalaNote,
    workers: { cut: j.cutBy, join: j.joinBy, edge: j.edgeBy, bottom: j.bottomBy },
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 md:max-w-none">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-bold text-text-primary">
            {meta.title} <span className="text-text-secondary">· {rows.length}</span>
          </h1>
          <p className="m-0 max-w-2xl text-sm text-text-secondary">{meta.sub}</p>
        </div>
        <form method="GET" action={meta.path} className="flex gap-2 md:w-[340px]">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="🔍 №, көлік, тауар, менеджер"
            className="min-h-11 min-w-0 flex-1 rounded-pill border border-border bg-surface px-4 text-sm focus:border-accent focus:outline-none"
          />
          <button type="submit" className="rounded-pill bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
            Іздеу
          </button>
        </form>
      </div>

      <PushSetup />

      {stale > 0 && <CloseStaleButton count={stale} />}

      {rows.length === 0 ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">{q ? "Ештеңе табылмады." : meta.empty}</p>
      ) : (
        <JobList list={list} jobs={rows} />
      )}
    </div>
  );
}
