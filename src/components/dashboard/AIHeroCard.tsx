import { Bot } from "lucide-react";
import Link from "next/link";

export function AIHeroCard({
  userName,
  message,
  title,
  greeting,
  ctaLabel,
}: {
  userName: string;
  message: string;
  title: string;
  greeting: string;
  ctaLabel: string;
}) {
  return (
    <div className="shadow-card flex flex-col justify-between gap-4 rounded-card bg-accent-tint p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
          <Bot size={20} />
        </span>
        <h3 className="pt-2 text-sm font-semibold text-text-primary">{title}</h3>
      </div>

      <p className="text-sm leading-relaxed text-text-primary">
        {greeting}, {userName}! {message}
      </p>

      <Link
        href="/analytics"
        className="w-fit rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
