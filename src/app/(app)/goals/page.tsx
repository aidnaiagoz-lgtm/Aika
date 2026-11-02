import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { getGoalsPage, currentMonth, shiftMonth } from "@/lib/domain/goals";
import { GoalsForm } from "./GoalsForm";

const MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ m?: string; saved?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isLeader(user)) redirect("/rating");

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : currentMonth();
  const data = await getGoalsPage(month);
  const maxH = Math.max(1, ...data.history.map((h) => Math.max(h.goal ?? 0, h.done)));

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">🎯 Мақсаттар</h1>
          <p className="text-sm text-text-secondary">Тек CEO мен РОП өзгерте алады · сақтағаннан кейін менеджерлердің «Рейтинг» бетінде бірден жаңарады</p>
        </div>
        <Link href={`/goals?m=${shiftMonth(month, -1)}`} className="rounded-xl border border-border bg-surface px-3 py-2 font-bold">◀</Link>
        <span className="rounded-xl bg-[#0b1a45] px-4 py-2 font-bold text-white">{label(month)}</span>
        <Link href={`/goals?m=${shiftMonth(month, 1)}`} className="rounded-xl border border-border bg-surface px-3 py-2 font-bold">▶</Link>
      </div>

      {sp.saved && <div className="rounded-card bg-[#e7f7ec] px-4 py-3 text-sm font-semibold text-[#16a34a]">✅ Мақсаттар сақталды</div>}
      {sp.error && <div className="rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">{sp.error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <GoalsForm
          key={month}
          month={month}
          monthLabel={MONTHS[Number(month.slice(5, 7)) - 1]}
          prevLabel={MONTHS[Number(shiftMonth(month, -1).slice(5, 7)) - 1]}
          rows={data.rows}
          team={data.team}
          prevTeam={data.prevTeam}
          teamSuggestion={data.teamSuggestion}
        />
        <div className="flex flex-col gap-4">
          <section className="rounded-[22px] bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-text-primary">📜 Тарих</h2>
              <span className="text-xs text-text-secondary">мақсат vs нәтиже (тауар)</span>
            </div>
            <div className="flex h-[150px] items-end gap-3">
              {data.history.map((h) => {
                const pct = h.goal ? Math.round((h.done / h.goal) * 100) : null;
                return (
                  <div key={h.month} className="flex flex-1 flex-col items-center gap-1 text-[11px] text-text-secondary">
                    <i className="block w-full rounded-t-lg rounded-b bg-[#dbe5ff]" style={{ height: `${Math.max(6, (h.done / maxH) * 100)}px` }} />
                    <span>{MONTHS[Number(h.month.slice(5, 7)) - 1]}</span>
                    <b className={pct === null ? "text-text-secondary" : pct >= 100 ? "text-[#16a34a]" : "text-danger"}>
                      {pct === null ? `${h.done} тауар` : `${pct >= 100 ? "✅" : "❌"} ${pct}%`}
                    </b>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="rounded-[22px] bg-surface p-5 text-sm text-text-secondary">
            <h2 className="mb-2 text-base font-bold text-text-primary">ℹ️ Қалай жұмыс істейді</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Команда мақсаты <b>тауар санымен</b> — менеджерлерге ақша мақсаты көрсетілмейді.</li>
              <li>Жеке мақсатты бос қалдырсаңыз — ол менеджерге қойылмайды.</li>
              <li>Ай ортасында да өзгертуге болады; әр өзгеріс журналға жазылады.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
