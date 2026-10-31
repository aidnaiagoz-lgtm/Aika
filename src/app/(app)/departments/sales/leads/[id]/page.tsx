import Link from "next/link";
import { PermissionAction } from "@/lib/db";
import { Card, StatusBadge, AccessDenied } from "@/lib/ui";
import { can, ForbiddenError } from "@/lib/rbac";
import { getLead, getLeadAuditLog, listSalesEmployees } from "@/lib/domain/sales";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { LEAD_STATUS_TONE } from "@/lib/sales-labels";
import { markContactedAction, markLeadLostAction, updateLeadAction, reassignLeadAction, convertLeadAction } from "../../actions";

const LEAD_SOURCES = ["instagram", "tiktok", "olx", "kaspi", "referral", "manual"];

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const { id } = await params;
  const { error } = await searchParams;

  try {
    const lead = await getLead(user, id);
    const canReassign = can(user, "deals", PermissionAction.APPROVE);
    const [auditLog, employees] = await Promise.all([
      getLeadAuditLog(user, id),
      canReassign ? listSalesEmployees() : Promise.resolve([]),
    ]);
    const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { dateStyle: "medium", timeStyle: "short" });

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{lead.fullName}</h1>
            <p className="text-sm text-text-secondary">{dateFmt.format(lead.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={LEAD_STATUS_TONE[lead.status]}>{dict.sales.leadStatusLabel[lead.status]}</StatusBadge>
            <Link href="/departments/sales/work" className="text-sm font-medium text-accent hover:underline">
              {t("← Тізімге оралу", "← Назад к списку")}
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        <Card title={t("Әрекеттер", "Действия")}>
          <div className="flex flex-wrap items-center gap-2">
            {lead.status === "NEW" && (
              <ActionForm action={markContactedAction} leadId={lead.id} label={t("Хабарласылды деп белгілеу", "Отметить связались")} primary />
            )}
            {lead.status !== "CONVERTED" && lead.status !== "LOST" && (
              <form action={convertLeadAction} className="flex items-center gap-1.5">
                <input type="hidden" name="leadId" value={lead.id} />
                <input
                  type="number"
                  name="amount"
                  placeholder={t("Сома", "Сумма")}
                  min={0}
                  required
                  className="w-32 rounded-icon border border-border bg-page-bg px-2.5 py-1.5 text-xs text-text-primary"
                />
                <button type="submit" className="rounded-pill bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover">
                  {t("Мәмілеге айналдыру", "Превратить в сделку")}
                </button>
              </form>
            )}
            {!["CONVERTED", "LOST"].includes(lead.status) && (
              <ActionForm action={markLeadLostAction} leadId={lead.id} label={t("Жоғалтылды деп белгілеу", "Отметить потерянным")} />
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={t("Мәліметтер", "Данные")}>
            <form action={updateLeadAction} className="flex flex-col gap-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <Field label={t("Аты-жөні", "ФИО")}>
                <input name="fullName" defaultValue={lead.fullName} className={inputClass} />
              </Field>
              <Field label={t("Телефон", "Телефон")}>
                <input name="phone" defaultValue={lead.phone} className={inputClass} />
              </Field>
              <Field label={t("Дереккөз", "Источник")}>
                <select name="source" defaultValue={lead.source} className={inputClass}>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className="w-fit rounded-pill bg-page-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-border">
                {t("Сақтау", "Сохранить")}
              </button>
            </form>
            {lead.convertedDeal && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-text-secondary">
                {t("Мәмілеге айналды", "Стал сделкой")} →{" "}
                <Link href={`/departments/sales/deals/${lead.convertedDeal.id}`} className="text-accent hover:underline">
                  {t("мәмілені көру", "посмотреть сделку")}
                </Link>
              </p>
            )}
          </Card>

          <Card title={t("Тағайындау", "Назначение")}>
            <p className="text-sm text-text-primary">{lead.assignedTo?.fullName ?? t("Тағайындалмаған", "Не назначен")}</p>
            {canReassign && (
              <form action={reassignLeadAction} className="mt-3 flex items-end gap-2 border-t border-border pt-3">
                <input type="hidden" name="leadId" value={lead.id} />
                <Field label={t("Менеджерді ауыстыру", "Сменить менеджера")}>
                  <select name="assignedToId" defaultValue={lead.assignedToId ?? ""} className={inputClass}>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="submit" className="rounded-pill bg-page-bg px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-border">
                  {t("Ауыстыру", "Сменить")}
                </button>
              </form>
            )}
          </Card>
        </div>

        <Card title={t("Аудит журналы", "Журнал аудита")}>
          {auditLog.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("Жазба жоқ", "Записей нет")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {auditLog.map((a) => (
                <li key={a.id} className="border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">{dateFmt.format(a.createdAt)}</span>
                    <span className="font-medium text-text-primary">
                      {a.actor?.employee?.fullName ?? a.actor?.email ?? t("Жүйе", "Система")} — {a.action}
                    </span>
                  </div>
                  {(a.oldValue || a.newValue) && (
                    <div className="mt-0.5 pl-1 text-xs text-text-secondary">
                      {a.oldValue ? `${JSON.stringify(a.oldValue)} → ` : ""}
                      {a.newValue ? JSON.stringify(a.newValue) : ""}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
}

const inputClass =
  "rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function ActionForm({
  action,
  leadId,
  label,
  primary,
}: {
  action: (formData: FormData) => void | Promise<void>;
  leadId: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        className={`rounded-pill px-4 py-2 text-sm font-semibold transition-colors ${
          primary ? "bg-accent text-white hover:bg-accent-hover" : "bg-page-bg text-text-primary hover:bg-border"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
