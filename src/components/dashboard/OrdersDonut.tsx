"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { StatusTone } from "@/lib/ui";

const TONE_HEX: Record<StatusTone, string> = {
  new: "#4f7df3",
  processing: "#3b4b9c",
  shipping: "#f5a623",
  success: "#22c55e",
  neutral: "#aeb4c2",
  danger: "#ef4444",
};

export function OrdersDonut({
  data,
  total,
  totalLabel,
}: {
  data: { key: string; label: string; count: number; tone: StatusTone }[];
  total: number;
  totalLabel: string;
}) {
  return (
    <div className="relative h-44 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" innerRadius="70%" outerRadius="100%" paddingAngle={2} stroke="none">
            {data.map((entry) => (
              <Cell key={entry.key} fill={TONE_HEX[entry.tone]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums text-text-primary">{new Intl.NumberFormat("ru-RU").format(total)}</span>
        <span className="text-xs text-text-secondary">{totalLabel}</span>
      </div>
    </div>
  );
}
