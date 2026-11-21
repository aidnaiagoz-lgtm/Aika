import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canUseWarehouse } from "@/lib/domain/warehouse/stock";
import { MoySkladImport } from "./MoySkladImport";
import { PhotoUpload } from "./PhotoUpload";
import { getLocale } from "@/lib/locale";
import { WH } from "../t";

export const dynamic = "force-dynamic";

/** Қойма → МойСкладтан жүктеу (CEO, 2026-11-18): «Остатки по товарам» Excel файлынан цех материалдарының қалдығы. */
export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canUseWarehouse(user)) redirect("/dashboard");
  const locale = await getLocale();
  const t = WH[locale].ms;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-bold text-text-primary">{t.title}</h1>
        <p className="m-0 mt-1 max-w-3xl text-sm text-text-secondary">{t.intro}</p>
      </div>
      <MoySkladImport locale={locale} />
      <PhotoUpload locale={locale} />
    </div>
  );
}
