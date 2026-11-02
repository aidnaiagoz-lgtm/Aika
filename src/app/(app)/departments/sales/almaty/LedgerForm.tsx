import { Card } from "@/lib/ui";
import { LEDGER_FIELD_GROUPS } from "@/lib/domain/sales-ledger/fields";

function toInputValue(type: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (type === "date" && value instanceof Date) return value.toISOString().slice(0, 10);
  if (type === "datetime-local" && value instanceof Date) return value.toISOString().slice(0, 16);
  return String(value);
}

export function LedgerForm({
  action,
  defaultValues,
  rowId,
  submitLabel,
  lockedManager,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: Record<string, unknown>;
  rowId?: string;
  submitLabel: string;
  /** Менеджер үшін "Менеджер" өрісі логиннен толады және өзгермейді (серверде де тексеріледі). */
  lockedManager?: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {rowId && <input type="hidden" name="id" value={rowId} />}

      {LEDGER_FIELD_GROUPS.map((group) => (
        <Card key={group.title} title={group.title}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.fields.map((field) => {
              const locked = field.readOnly || (field.name === "manager" && lockedManager !== undefined);
              const value = field.name === "manager" && lockedManager !== undefined ? lockedManager : toInputValue(field.type, defaultValues?.[field.name]);
              return (
              <div key={field.name} className="flex flex-col gap-1.5">
                <label htmlFor={field.name} className="text-xs font-medium text-text-secondary">
                  {field.label}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  step={field.type === "number" ? "any" : undefined}
                  defaultValue={value}
                  disabled={field.readOnly}
                  readOnly={locked}
                  className={`rounded-icon border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                    locked ? "bg-border/40 text-text-secondary" : "bg-page-bg text-text-primary"
                  }`}
                />
              </div>
              );
            })}
          </div>
        </Card>
      ))}

      <button
        type="submit"
        className="w-fit rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        {submitLabel}
      </button>
    </form>
  );
}
