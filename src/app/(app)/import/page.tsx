import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { ImportClient } from "./ImportClient";
import { lastSheetSyncAt, sheetSyncConfigured } from "@/lib/domain/sales-ledger/sheet-sync";
import { syncSheetNowAction } from "./actions";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ sync?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isLeader(user)) redirect("/rating");
  const sp = await searchParams;
  const last = await lastSheetSyncAt();
  const configured = sheetSyncConfigured();
  const fmt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Almaty", dateStyle: "short", timeStyle: "short" });

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Excel импорт</h1>
        <p className="mt-1 text-sm text-text-secondary">
          «Продажи» кестесін сайтқа көшіру. Соңғы 30 күнде жұмыс істеген менеджерлерге аккаунт автоматты ашылады,
          рейтинг бірден есептеледі. Тек CEO мен РОП.
        </p>
      </div>
      <section id="sheet-sync" className="rounded-[20px] border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Google таблицадан автоматты жаңарту</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {configured
                ? "Менеджерлер толтыратын Google таблица (соңғы 40 күн) сайтқа өздігінен түседі: Рейтинг ашылғанда 10 минутта бір рет және күн сайын кешке."
                : "Қосылмаған — SALES_SHEET_ID орнатылмаған."}
            </p>
            <p className="mt-1 text-xs text-text-secondary">Соңғы жаңарту: {last ? fmt.format(last) : "әлі болған жоқ"}</p>
          </div>
          {configured && (
            <form action={syncSheetNowAction}>
              <button type="submit" className="rounded-xl bg-[#1f4fd8] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1a43b8]">
                Қазір жаңарту
              </button>
            </form>
          )}
        </div>
        {sp.sync && (
          <p className={`mt-3 rounded-xl px-3.5 py-2.5 text-sm ${sp.sync.startsWith("ok:") ? "bg-[#e7f7ec] text-[#15803d]" : "bg-danger/10 text-danger"}`}>
            {sp.sync.startsWith("ok:")
              ? `Жаңартылды: ${sp.sync.split(":")[1]} жол (соңғы 40 күн), таблицадан өшірілгені: ${sp.sync.split(":")[2]}`
              : sp.sync.slice(4)}
          </p>
        )}
      </section>

      <h2 className="mt-2 text-sm font-bold uppercase tracking-wide text-text-secondary">Excel файлынан бір реттік импорт</h2>
      <ImportClient />
    </div>
  );
}
