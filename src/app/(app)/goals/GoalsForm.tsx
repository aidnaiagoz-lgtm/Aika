"use client";

import { useState } from "react";
import { saveGoalsAction } from "./actions";

type Row = {
  employeeId: string;
  name: string;
  prevMonthItems: number;
  currentItems: number;
  suggestion: number;
  goal: number | null;
  prevGoal: number | null;
};

const inputCls =
  "w-20 rounded-[10px] border-[1.5px] border-border bg-white px-2.5 py-1.5 text-center font-bold text-text-primary focus:border-[#1f4fd8] focus:outline-none focus:ring-[3px] focus:ring-[#1f4fd8]/15";

export function GoalsForm({
  month,
  monthLabel,
  prevLabel,
  rows,
  team,
  prevTeam,
  teamSuggestion,
}: {
  month: string;
  monthLabel: string;
  prevLabel: string;
  rows: Row[];
  team: { teamItems: number; reward: string } | null;
  prevTeam: { teamItems: number; reward: string } | null;
  teamSuggestion: number;
}) {
  const [teamItems, setTeamItems] = useState<string>(team ? String(team.teamItems) : "");
  const [reward, setReward] = useState<string>(team?.reward ?? "");
  const [goals, setGoals] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.employeeId, r.goal === null ? "" : String(r.goal)]))
  );
  const sum = Object.values(goals).reduce((t, v) => t + (Number(v) || 0), 0);

  const copyPrev = () => {
    if (prevTeam) {
      setTeamItems(String(prevTeam.teamItems));
      setReward(prevTeam.reward);
    }
    setGoals(Object.fromEntries(rows.map((r) => [r.employeeId, r.prevGoal === null ? "" : String(r.prevGoal)])));
  };
  const fillSuggest = () => {
    setTeamItems(String(teamSuggestion));
    setGoals(Object.fromEntries(rows.map((r) => [r.employeeId, String(r.suggestion)])));
  };

  return (
    <form action={saveGoalsAction} className="flex flex-col rounded-[22px] bg-surface p-5">
      <input type="hidden" name="month" value={month} />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary">🤝 Команда мақсаты</h2>
        <span className="text-xs text-text-secondary">менеджерлерге көрінеді</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Тауар саны
          <input
            name="teamItems"
            type="number"
            min={1}
            required
            value={teamItems}
            onChange={(e) => setTeamItems(e.target.value)}
            className={`${inputCls} w-28 py-2 text-lg`}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
          Сыйлық (еркін мәтін)
          <input
            name="reward"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            placeholder="Барлығына +15 000 ₸ бонус 🎁"
            className="rounded-[10px] border-[1.5px] border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-[#1f4fd8] focus:outline-none"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        💡 Ұсыныс: <b className="text-[#1f4fd8]">{teamSuggestion}</b> (соңғы 3 айдың орташасы + 10%)
      </p>

      <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-text-primary">👤 Жеке мақсаттар</h2>
        <div className="flex gap-2">
          <button type="button" onClick={copyPrev} className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text-primary hover:bg-page-bg">
            📋 Өткен айдан көшіру
          </button>
          <button type="button" onClick={fillSuggest} className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-[#1f4fd8] hover:bg-page-bg">
            ✨ Ұсыныс бойынша толтыру
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-secondary">Менеджерлер әлі тіркелмеген.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-secondary">
              <th className="py-2 pr-2">Менеджер</th>
              <th className="py-2 pr-2">{prevLabel}</th>
              <th className="py-2 pr-2">{monthLabel} (қазір)</th>
              <th className="py-2 pr-2">Ұсыныс</th>
              <th className="py-2">{monthLabel} мақсаты</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} className="border-b border-border last:border-0">
                <td className="py-2 pr-2 font-semibold">
                  <input type="hidden" name="employeeId" value={r.employeeId} />
                  {r.name}
                </td>
                <td className="py-2 pr-2">{r.prevMonthItems}</td>
                <td className="py-2 pr-2">
                  {r.currentItems}
                  {goals[r.employeeId] ? ` / ${goals[r.employeeId]}` : ""}
                </td>
                <td className="py-2 pr-2 font-semibold text-[#1f4fd8]">{r.suggestion}</td>
                <td className="py-2">
                  <input
                    name={`goal_${r.employeeId}`}
                    type="number"
                    min={1}
                    value={goals[r.employeeId]}
                    onChange={(e) => setGoals((g) => ({ ...g, [r.employeeId]: e.target.value }))}
                    className={inputCls}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-text-secondary">
          Жеке мақсаттар қосындысы: <b className="text-text-primary">{sum}</b> · команда мақсаты:{" "}
          <b className="text-text-primary">{teamItems || "—"}</b>
        </span>
        <button type="submit" className="rounded-xl bg-[#1f4fd8] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1a43b8]">
          💾 Сақтау
        </button>
      </div>
    </form>
  );
}
