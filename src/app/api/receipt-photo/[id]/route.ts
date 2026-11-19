import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUseWarehouse } from "@/lib/domain/warehouse/stock";

/** Накладнаның фотосы — тек қойманы көре алатындарға. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canUseWarehouse(user)) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const p = await prisma.stockReceiptPhoto.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.data), { headers: { "Content-Type": p.mime, "Cache-Control": "private, max-age=2592000, immutable" } });
}
