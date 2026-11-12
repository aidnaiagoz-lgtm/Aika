import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canUseWorkshop, isLeader } from "@/lib/access";
import { jobCounts, listJobs, listWorkers, syncWorkshopJobs, workshopActiveSince, type JobView } from "@/lib/domain/workshop";
import { jobHeadline, leatherNorm } from "@/lib/domain/workshop/calc";
import { JobCard, type ClientJob } from "./JobCard";
import { ActivateButton } from "./ActivateButton";

export const dynamic = "force-dynamic";

const TABS: Array<{ view: JobView; label: string }> = [
  { view: "new", label: "Жаңа" },
  { view: "work", label: "Жасалып жатыр" },
  { view: "done", label: "Дайын (14 күн)" },
];

export default async function WorkshopPage({ searchParams }: { searchParams: Promise<{ view?: string; job?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canUseWorkshop(user)) redirect("/dashboard");

  const sp = await searchParams;
  const since = await workshopActiveSince();

  if (!since) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="m-0 text-2xl font-bold text-text-primary">Цех</h1>
        <div className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-card">
          <p className="m-0 text-[15px] text-text-primary">
            Цех жүйесі әлі іске қосылмаған. Іске қосылған күннен бастап Продажиде <b>«Цех ✓»</b> қойылған әр сатылым цехқа тапсырма
            болып түседі, Бекзатқа хабар барады.
          </p>
          <p className="m-0 text-sm text-text-secondary">
            Бұрынғы сатылымдар тапсырма болып ашылмайды. Операция бағалары: резка 1 500 ₸, стыковка 1 500 ₸, окантовка 1 500 ₸, дно 500 ₸
            (кейін «Айлық есебі» бетінен өзгертуге болады).
          </p>
          {isLeader(user) ? <ActivateButton /> : <p className="m-0 text-sm text-text-secondary">Іске қосуды CEO жасайды.</p>}
        </div>
      </div>
    );
  }

  // Google-дан келген соңғы өзгерістерді тапсырмаларға көшіру (2 минуттық синхрондауды күтпей)
  await syncWorkshopJobs(undefined, { recentDays: 3 }).catch((e) => console.error("[workshop] sync", e instanceof Error ? e.message : e));

  const view: JobView = sp.view === "work" || sp.view === "done" ? sp.view : "new";
  const [jobs, counts, workers] = await Promise.all([listJobs(user, view), jobCounts(user), listWorkers(user)]);
  const workerNames = workers.map((w) => w.name);

  const clientJobs: ClientJob[] = jobs.map((j) => ({
    id: j.id,
    orderNo: j.orderNo,
    status: j.status,
    receivedAt: j.receivedAt.toISOString(),
    doneAt: j.doneAt?.toISOString() ?? null,
    manager: j.manager,
    headline: jobHeadline(j),
    leatherType: j.leatherType,
    leatherThread: j.leatherThread,
    leatherPiping: j.leatherPiping,
    matType: j.matType,
    pocketsPairs: j.pocketsPairs == null ? null : Number(j.pocketsPairs),
    lekalaNote: j.lekalaNote,
    leatherMeters: j.leatherMeters == null ? null : Number(j.leatherMeters),
    leatherOwner: j.leatherOwner,
    norm: leatherNorm(j.product),
    cutBy: j.cutBy,
    joinBy: j.joinBy,
    edgeBy: j.edgeBy,
    bottomBy: j.bottomBy,
  }));

  const countOf: Record<JobView, number> = counts;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-bold text-text-primary">Цех тапсырмалары</h1>
        <p className="m-0 text-sm text-text-secondary">
          Продажиде «Цех ✓» қойылған сатылымдар өзі түседі. Операцияны кім жасағанын белгілеңіз — айлық өзі есептеледі.
        </p>
      </div>

      <nav className="flex gap-2 overflow-x-auto" aria-label="Тапсырма күйі">
        {TABS.map((t) => (
          <Link
            key={t.view}
            href={t.view === "new" ? "/workshop" : `/workshop?view=${t.view}`}
            className={`whitespace-nowrap rounded-pill px-4 py-2.5 text-sm font-semibold ${
              view === t.view ? "bg-[#0b1a45] text-white" : "border border-border bg-surface text-text-secondary"
            }`}
          >
            {t.label} · {countOf[t.view]}
          </Link>
        ))}
      </nav>

      {clientJobs.length === 0 ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">
          {view === "new" ? "Жаңа тапсырма жоқ. Менеджер «Цех ✓» қойса, осында бірден шығады." : "Бұл бөлімде тапсырма жоқ."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {clientJobs.map((j) => (
            <JobCard key={j.id} job={j} workers={workerNames} highlight={sp.job === j.id} />
          ))}
        </div>
      )}
    </div>
  );
}
