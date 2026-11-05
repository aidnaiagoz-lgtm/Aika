import { LEDGER_COLUMNS } from "@/lib/domain/sales-ledger/fields";

/** Клиентке жіберілетін жол: 45 мән (A..AS) + қызметтік өрістер. */
export interface ClientRow {
  id: string;
  createdById: string | null;
  editable: boolean;
  /** Google таблицадан келген жол (синхрондау қосулы кезде — тек таблицада өзгертіледі) */
  synced: boolean;
  values: Array<string | number | null>;
}

export function toClientRow(
  row: Record<string, unknown> & { id: string; createdById: string | null; importKey?: string | null },
  editable: boolean
): ClientRow {
  return {
    id: row.id,
    createdById: row.createdById,
    editable,
    synced: !!row.importKey?.startsWith("excel:"),
    values: LEDGER_COLUMNS.map((c) => {
      const v = row[c.name];
      if (v === null || v === undefined) return null;
      if (v instanceof Date) return v.toISOString();
      if (typeof v === "object" && "toNumber" in (v as object)) return (v as { toNumber(): number }).toNumber();
      if (typeof v === "number" || typeof v === "string") return v;
      return String(v);
    }),
  };
}
