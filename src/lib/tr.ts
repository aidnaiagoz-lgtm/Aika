import type { Locale } from "@/lib/i18n";

/** Order/Production/Warehouse/Finance модульдері толық i18n Dictionary-ге
 *  қосылмаған (§ бетінде тек KK жазылған), сондықтан жаңа мәтіндерді осы шағын
 *  helper арқылы KK/RU жұбымен беру ыңғайлы: tr(locale, { kk: "...", ru: "..." }). */
export function tr(locale: Locale, dict: { kk: string; ru: string }): string {
  return locale === "ru" ? dict.ru : dict.kk;
}
