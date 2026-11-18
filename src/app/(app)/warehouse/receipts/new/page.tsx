import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { receiptFormData } from "@/lib/domain/warehouse/stock";
import { ReceiptForm } from "./ReceiptForm";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  let data;
  try {
    data = await receiptFormData(user);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={await getLocale()} />;
    throw e;
  }
  return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">Жаңа кіріс</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">Жеткізушіден келген материал қалдыққа өзі қосылады</p>
        </div>
        <ReceiptForm materials={data.materials} suppliers={data.suppliers} />
      </div>
    );
}
