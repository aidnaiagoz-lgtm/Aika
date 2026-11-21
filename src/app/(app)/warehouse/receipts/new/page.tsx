import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { receiptFormData } from "@/lib/domain/warehouse/stock";
import { ReceiptForm } from "./ReceiptForm";
import { WH } from "../../t";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = WH[locale];
  let data;
  try {
    data = await receiptFormData(user);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">{t.newReceipt}</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">{t.rec.newSubtitle}</p>
        </div>
        <ReceiptForm locale={locale} materials={data.materials} suppliers={data.suppliers} />
      </div>
    );
}
