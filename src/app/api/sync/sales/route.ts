import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { upsertLedgerRows, reconcileSyncedWindow, type ExcelRow } from "@/lib/domain/sales-ledger/import";

// Google Sheets → сайт синхрондауы. Таблицадағы Apps Script (docs/integrations/google-sheets-sync.gs)
// әр 10 минут сайын соңғы күндердің жолдарын осында жібереді.
// Қорғау: "Authorization: Bearer <SALES_SYNC_TOKEN>" — токен тек Vercel env-де және скрипттің Script Properties-інде.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = process.env.SALES_SYNC_TOKEN ?? "";
  if (expected.length < 32) return false; // токен қойылмаса — синхрондау өшірулі
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Body = {
  rows?: ExcelRow[];
  /** Соңғы бөлікпен бірге: терезедегі барлық № — таблицадан өшірілгендерді сайттан да алып тастау үшін */
  reconcile?: { from: string; nos: number[] };
};

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  try {
    const result: Record<string, unknown> = { ok: true };
    if (Array.isArray(body.rows) && body.rows.length) {
      Object.assign(result, await upsertLedgerRows(body.rows));
    }
    if (body.reconcile) {
      const nos = (body.reconcile.nos ?? []).filter((n) => Number.isFinite(n));
      // Қорғаныс: бос тізіммен бүкіл терезені өшіріп жібермеу үшін
      if (nos.length === 0) return Response.json({ ok: false, error: "empty reconcile list" }, { status: 400 });
      Object.assign(result, await reconcileSyncedWindow(body.reconcile.from, nos));
      await prisma.auditLog.create({
        data: { action: "SYNC", entityType: "SalesLedgerRow", entityId: "google-sheets", newValue: { from: body.reconcile.from, rows: nos.length } },
      });
      revalidatePath("/rating");
      revalidatePath("/departments/sales/almaty");
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "sync error" }, { status: 500 });
  }
}
