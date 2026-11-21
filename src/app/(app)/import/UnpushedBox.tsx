import { TriangleAlert } from "lucide-react";

const money = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} ₸`;

/** Сайтта жазылып, Google кестеге түспей тұрған сатылымдар (скрипт қатесі). Өшіру жоқ — себебін түзету керек. */
export function UnpushedBox({ count, sum, nos, managers, error }: { count: number; sum: number; nos: number[]; managers: string[]; error: string | null }) {
  const validation = !!error && /validation|проверк|правил/i.test(error);
  return (
    <div id="unpushed" className="rounded-card border border-[#fde68a] bg-[#fffbeb] p-5 text-sm text-text-primary">
      <div className="mb-1 flex items-center gap-2 font-bold text-[#b45309]">
        <TriangleAlert size={16} /> Google кестеге түспей тұрған сатылым: {count}
      </div>
      №{nos.slice(0, 10).join(", №")}
      {managers.length ? ` (${managers.join(", ")})` : ""} — сайтта бар, рейтинг пен айналымда саналып жатыр (<b>{money(sum)}</b>), бірақ Google кестеде жоқ,
      сондықтан екі жақтағы сома әртүрлі. Сайт 2 минут сайын қайта жіберіп көреді.
      {error && (
        <div className="mt-2 rounded-[10px] bg-white/70 px-3 py-2 font-mono text-xs text-text-secondary">Скрипт қатесі: {error}</div>
      )}
      <div className="mt-2 font-semibold">
        {validation
          ? "Себебі: кестедегі ашылмалы тізімде (мыс. «Менеджер») бұл мән жоқ. Кестеде сол бағанның тізіміне қосыңыз немесе заказды менеджер атынан енгізіңіз."
          : "Не істеу керек: төмендегі «Сайттан Google кестеге» бөлімінде скриптті қайта көшіріп, Apps Script-ке қойып, «Новое развертывание» жасаңыз."}
      </div>
    </div>
  );
}
