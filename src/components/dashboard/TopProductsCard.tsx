import { Card } from "@/lib/ui";
import { formatTenge } from "@/lib/demo-data";

export function TopProductsCard({ products, title }: { products: { name: string; value: number }[]; title: string }) {
  const max = Math.max(...products.map((p) => p.value));

  return (
    <Card title={title}>
      <div className="flex flex-col gap-4">
        {products.map((p) => (
          <div key={p.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-primary">{p.name}</span>
              <span className="font-semibold tabular-nums text-text-primary">{formatTenge(p.value)}</span>
            </div>
            <div className="h-1.5 w-full rounded-pill bg-page-bg">
              <div
                className="h-1.5 rounded-pill bg-accent"
                style={{ width: `${Math.max(8, (p.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
