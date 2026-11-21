/**
 * «Дайын»-нан кейінгі жол (CEO, 2026-11-21): Дайын → Орнатушы алды → Клиент алды.
 * «Установка» емес заказда орнатушы қадамы жоқ: Дайын → Клиент алды.
 */
export interface PathInfo {
  doneAt: string | null;
  needsInstaller: boolean;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  handedAt: string | null;
  handedBy: string | null;
}

const tm = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const dm = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
const when = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Date.now() - d.getTime() < 18 * 3600_000 ? tm.format(d) : dm.format(d);
};

type Step = { title: string; sub: string; state: "ok" | "cur" | "wait" };

export function pathSteps(p: PathInfo): Step[] {
  const steps: Step[] = [{ title: "Дайын", sub: when(p.doneAt), state: "ok" }];
  if (p.needsInstaller) {
    steps.push(
      p.pickedUpAt
        ? { title: `${p.pickedUpBy ?? "Орнатушы"} алды`, sub: when(p.pickedUpAt), state: "ok" }
        : { title: "Орнатушы", sub: p.handedAt ? "—" : "күтіп тұр", state: p.handedAt ? "ok" : "cur" },
    );
  }
  const readyForClient = !p.needsInstaller || !!p.pickedUpAt || !!p.handedAt;
  steps.push(
    p.handedAt
      ? { title: "Клиент алды", sub: [p.handedBy, when(p.handedAt)].filter(Boolean).join(" · "), state: "ok" }
      : { title: "Клиент", sub: readyForClient ? "күтіп тұр" : "—", state: readyForClient ? "cur" : "wait" },
  );
  return steps;
}

/** Цехта тұр ма (орнатушы әлі алмаған «установка» заказы) */
export const waitingInstaller = (p: PathInfo) => p.needsInstaller && !p.pickedUpAt && !p.handedAt;

export function PathSteps({ p }: { p: PathInfo }) {
  return (
    <div className="flex items-start gap-1">
      {pathSteps(p).map((s, i) => (
        <div key={i} className="flex min-w-[84px] flex-col">
          <div
            className="mb-1.5 h-1 w-full rounded-full"
            style={{
              background:
                s.state === "ok"
                  ? "var(--color-accent, #6a4ff5)"
                  : s.state === "cur"
                    ? "repeating-linear-gradient(90deg, var(--color-accent, #6a4ff5) 0 6px, transparent 6px 10px)"
                    : "#e3e5eb",
            }}
          />
          <span className={`whitespace-nowrap text-xs font-semibold ${s.state === "wait" ? "text-text-secondary/70" : "text-text-primary"}`}>{s.title}</span>
          <span className="whitespace-nowrap text-[11px] text-text-secondary">{s.sub}</span>
        </div>
      ))}
    </div>
  );
}
