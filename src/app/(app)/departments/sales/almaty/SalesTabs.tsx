import Link from "next/link";

// «Продажи · Алматы» бетінің қойындылары (бір деректің көріністері)
export function SalesTabs({ on }: { on: "sales" | "leads" }) {
  const tabs = [
    ["sales", "Продажи", "/departments/sales/almaty"],
    ["leads", "Лидтер", "/departments/sales/almaty/leads"],
  ] as const;
  return (
    <div className="flex items-center gap-1.5">
      {tabs.map(([k, label, href]) => (
        <Link
          key={k}
          href={href}
          className={`rounded-lg border px-3.5 py-1 text-sm font-semibold ${on === k ? "border-[#0b1a45] bg-[#0b1a45] text-white" : "border-border bg-surface text-text-primary hover:bg-page-bg"}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
