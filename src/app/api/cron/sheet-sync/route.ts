import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { syncFromGoogleSheet } from "@/lib/domain/sales-ledger/sheet-sync";

// Vercel Cron (vercel.json) — күніне бір рет кепілді синхрондау. Vercel "Authorization: Bearer CRON_SECRET" жібереді.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return Response.json({ ok: false }, { status: 401 });
  try {
    const res = await syncFromGoogleSheet();
    revalidatePath("/rating");
    return Response.json({ ok: true, ...res });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "sync error" }, { status: 500 });
  }
}
