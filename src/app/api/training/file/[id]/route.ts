import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { blobToken } from "@/lib/domain/training";

// PDF-ті ашу: файл жабық (private) қоймада — тек сайтқа кірген қызметкер осы маршрут арқылы көре алады.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const m = await prisma.trainingMaterial.findUnique({ where: { id }, select: { kind: true, url: true, fileName: true } });
  if (!m || m.kind !== "pdf") return new NextResponse("Not found", { status: 404 });

  const file = await get(m.url, { access: "private", token: blobToken() }).catch((e) => {
    console.error("[training file]", e instanceof Error ? e.message : e);
    return null;
  });
  if (!file || file.statusCode !== 200) return new NextResponse("Not found", { status: 404 });

  const name = m.fileName || "file.pdf";
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
