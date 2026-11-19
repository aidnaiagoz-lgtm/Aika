import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Материал фотосы — тек кірген қолданушыға (қойма, цех беттері). ?v= өзгерсе ғана қайта жүктеледі. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const p = await prisma.materialPhoto.findUnique({ where: { materialId: id }, select: { mime: true, data: true } });
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.data), {
    headers: { "Content-Type": p.mime, "Cache-Control": "private, max-age=2592000, immutable" },
  });
}
