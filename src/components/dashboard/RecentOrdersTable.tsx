import Link from "next/link";
import { Card, StatusBadge, type StatusTone } from "@/lib/ui";
import { formatTenge } from "@/lib/demo-data";

export function RecentOrdersTable({
  orders,
  title,
  viewAllLabel,
  columns,
}: {
  orders: { id: string; customer: string; product: string; amount: number; status: StatusTone; statusLabel: string }[];
  title: string;
  viewAllLabel: string;
  columns: { orderNo: string; customer: string; product: string; amount: string; status: string };
}) {
  return (
    <Card
      title={title}
      action={
        <Link href="/departments/sales" className="text-sm font-medium text-accent hover:underline">
          {viewAllLabel}
        </Link>
      }
      className="col-span-2"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-text-secondary">
              <th className="pb-3 font-semibold">{columns.orderNo}</th>
              <th className="pb-3 font-semibold">{columns.customer}</th>
              <th className="pb-3 font-semibold">{columns.product}</th>
              <th className="pb-3 font-semibold">{columns.amount}</th>
              <th className="pb-3 font-semibold">{columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="py-3 font-medium text-text-primary">{o.id}</td>
                <td className="py-3 text-text-primary">{o.customer}</td>
                <td className="py-3 text-text-secondary">{o.product}</td>
                <td className="py-3 font-semibold tabular-nums text-text-primary">{formatTenge(o.amount)}</td>
                <td className="py-3">
                  <StatusBadge tone={o.status}>{o.statusLabel}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
