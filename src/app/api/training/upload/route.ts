import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { blobToken, isFileStorageConfigured, TRAINING_PDF_MAX_BYTES } from "@/lib/domain/training";

// Оқыту папкасына PDF жүктеу: браузер файлды Vercel Blob-қа тікелей жібереді,
// бұл маршрут тек бір реттік рұқсат (token) береді — кірген қызметкерге, бар папкаға, тек PDF.
// Жүктеп болған соң браузер addTrainingFileAction арқылы материалды базаға жазады.
export async function POST(request: Request) {
  if (!isFileStorageConfigured()) {
    return NextResponse.json({ error: "storageMissing" }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (!user) throw new Error("unauthorized");
        let folderId = "";
        try {
          folderId = String((JSON.parse(clientPayload ?? "{}") as { folderId?: unknown }).folderId ?? "");
        } catch {
          throw new Error("bad payload");
        }
        const folder = folderId ? await prisma.trainingFolder.findUnique({ where: { id: folderId }, select: { id: true } }) : null;
        if (!folder) throw new Error("folder not found");
        if (!pathname.startsWith(`training/${folderId}/`) || !/\.pdf$/i.test(pathname)) throw new Error("bad pathname");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: TRAINING_PDF_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[training upload]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "fileInvalid" }, { status: 400 });
  }
}
