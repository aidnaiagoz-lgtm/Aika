"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function SalesChart({ data, tooltipLabel }: { data: { date: string; value: number }[]; tooltipLabel: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7b61ff" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#7b61ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#eaecf1" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#8a8f9c" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: "#8a8f9c" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v / 1_000_000}M`}
          />
          <Tooltip
            formatter={(value: number) => [`${new Intl.NumberFormat("ru-RU").format(value)} ₸`, tooltipLabel]}
            contentStyle={{ borderRadius: 12, border: "1px solid #eaecf1", fontSize: 13 }}
          />
          <Area type="monotone" dataKey="value" stroke="#7b61ff" strokeWidth={2.5} fill="url(#salesFill)" dot={{ r: 4, fill: "#7b61ff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
