import Link from "next/link";
import { TestTag } from "@/lib/ui/TestTag";
import { isLeader } from "@/lib/access";
import type { FlowRow } from "@/lib/domain/orders/workflow";
import { Elapsed, HandedButton } from "./flow-ui";
import { PushSetup } from "../workshop/PushSetup";
import { PathSteps, waitingInstaller } from "@/lib/ui/PathSteps";

const dt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));

/** «Тігілуде» / «Дайын» беттерінің ортақ түрі — ұстамды кесте (телефонда — карточкалар). */
export function FlowPage({
  kind,
  rows,
  who,
  user,
}: {
  kind: "sewing" | "ready";
  rows: FlowRow[];
  who: "mine" | "all";
  user: Parameters<typeof isLeader>[0];
}) {
  const sewing = kind === "sewing";
  const base = sewing ? "/orders/sewing" : "/orders/ready";
  const leader = isLeader(user);
  const title = sewing ? "Тігілуде" : "Дайын";
  const subtitle = sewing
    ? who === "mine"
      ? "Цехқа жіберілген менің заказдарым"
      : "Цехқа жіберілген барлық заказдар"
    : who === "mine"
      ? "Цех бітірген, клиентке берілмеген заказдарым"
      : "Цех бітірген, клиентке берілмеген барлық заказдар";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-bold text-text-primary">{title}</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">{subtitle}</p>
        </div>
        {leader && (
          <div className="inline-flex rounded-pill bg-surface p-1 shadow-card">
            {(["mine", "all"] as const).map((w) => (
              <Link
                key={w}
                href={`${base}?who=${w}`}
                className={`rounded-pill px-3.5 py-1.5 text-sm font-semibold ${who === w ? "bg-accent/10 text-accent" : "text-text-secondary"}`}
              >
                {w === "mine" ? "Менің" : "Барлығы"}
              </Link>
            ))}
          </div>
        )}
      </div>

      <PushSetup />

      {rows.length === 0 ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-text-secondary shadow-card">
          {sewing ? "Цехта заказ жоқ." : "Дайын, берілмеген заказ жоқ."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-card bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-text-secondary">
                  {["№", "Клиент", "Көлік", "Тауар", ...(who === "all" ? ["Менеджер"] : []), ...(sewing ? ["Күйі", "Цехта"] : ["Жолы", "Қалдық", ""])].map(
                    (h, i) => (
                      <th key={i} className="whitespace-nowrap border-b border-border px-4 py-3 font-semibold">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums">
                      {r.orderNo}
                      <TestTag manager={r.manager} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="text-text-primary">{r.customer || "—"}</div>
                      <div className="text-xs text-text-secondary">{r.phone}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{r.car || "—"}</td>
                    <td className="min-w-[220px] px-4 py-3">
                      <div>{r.product || "—"}</div>
                      {r.leather && <div className="text-xs text-text-secondary">{r.leather}</div>}
                    </td>
                    {who === "all" && <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{r.manager || "—"}</td>}
                    {sewing ? (
                      <>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="rounded-md bg-page-bg px-2 py-1 text-xs text-text-secondary">{r.status === "NEW" ? "Кезекте" : "Тігілуде"}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Elapsed from={r.receivedAt} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="whitespace-nowrap px-4 py-3">
                          <PathSteps p={r} />
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 font-semibold tabular-nums ${r.remainder > 0 ? "text-danger" : "text-emerald-600"}`}>
                          {r.remainder > 0 ? `${money(r.remainder)} ₸` : "0"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <ReadyAction r={r} />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <div key={r.id} className="rounded-card bg-surface p-4 text-sm shadow-card">
                <div className="flex items-center justify-between">
                  <span className="font-bold tabular-nums">№{r.orderNo}</span>
                  {sewing ? <Elapsed from={r.receivedAt} /> : <span className="text-xs text-text-secondary">{r.doneAt ? dt.format(new Date(r.doneAt)) : ""}</span>}
                </div>
                <div className="mt-1 text-text-primary">
                  {r.customer || "—"} <span className="text-xs text-text-secondary">{r.phone}</span>
                </div>
                <div className="text-text-secondary">
                  {r.car} · {r.product}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {sewing ? (
                    <span className="rounded-md bg-page-bg px-2 py-1 text-xs text-text-secondary">{r.status === "NEW" ? "Кезекте" : "Тігілуде"}</span>
                  ) : (
                    <>
                      <span className={r.remainder > 0 ? "font-semibold text-danger" : "font-semibold text-emerald-600"}>
                        Қалдық: {r.remainder > 0 ? `${money(r.remainder)} ₸` : "0"}
                      </span>
                      <ReadyAction r={r} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Орнатушы әлі алмаған «установка» заказы — «Цехта тұр»; әйтпесе менеджер «Клиент алып кетті» басады. */
function ReadyAction({ r }: { r: FlowRow }) {
  if (waitingInstaller(r))
    return <span className="whitespace-nowrap rounded-pill bg-[#fff4e0] px-2.5 py-1 text-xs font-bold text-[#b45309]">Цехта тұр</span>;
  return <HandedButton id={r.id} />;
}
