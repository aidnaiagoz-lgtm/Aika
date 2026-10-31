import { Sparkles } from "lucide-react";
import { Card } from "@/lib/ui";

export function AIRecommendationsCard({ items, title }: { items: string[]; title: string }) {
  return (
    <Card title={title}>
      <ul className="flex flex-col gap-4">
        {items.map((text) => (
          <li key={text} className="flex items-start gap-3 text-sm text-text-primary">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-icon bg-accent-tint text-accent">
              <Sparkles size={16} />
            </span>
            <span className="pt-1">{text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
