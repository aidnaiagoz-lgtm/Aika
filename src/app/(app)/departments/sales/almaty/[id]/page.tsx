import Link from "next/link";
import { AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { getLedgerRow } from "@/lib/domain/sales-ledger";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { LedgerForm } from "../LedgerForm";
import { updateLedgerRowAction } from "../actions";

export default async function EditLedgerRowPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  const locale = await getLocale();

  try {
    const row = await getLedgerRow(user, id);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Жазбаны өзгерту — Сату Алматы</h2>
          <Link href="/departments/sales/almaty" className="text-sm font-medium text-accent hover:underline">
            ← Кестеге оралу
          </Link>
        </div>
        <LedgerForm action={updateLedgerRowAction} defaultValues={row} rowId={row.id} submitLabel="Сақтау" />
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}
