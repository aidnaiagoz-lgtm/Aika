import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PDF-ті ашу: файл сайттың базасында бөлік-бөлігімен сақталған — тек кірген қызметкер көре алады.
// Бөліктер бір-бірлеп оқылады, бүкіл файл бірден жадқа жүктелмейді.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const m = await prisma.trainingMaterial.findUnique({
    where: { id },
    select: { kind: true, fileName: true, fileSize: true, chunks: { select: { id: true }, orderBy: { index: "asc" } } },
  });
  if (!m || m.kind !== "pdf" || m.chunks.length === 0) return new NextResponse("Not found", { status: 404 });

  const ids = m.chunks.map((c) => c.id);
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= ids.length) return controller.close();
      const c = await prisma.trainingFileChunk.findUnique({ where: { id: ids[i++] }, select: { data: true } });
      if (!c) return controller.error(new Error("chunk missing"));
      controller.enqueue(new Uint8Array(c.data));
    },
  });

  const name = m.fileName || "file.pdf";
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      ...(m.fileSize ? { "Content-Length": String(m.fileSize) } : {}),
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
