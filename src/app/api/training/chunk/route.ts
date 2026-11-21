import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveTrainingFileChunk, TRAINING_CHUNK_BYTES, TrainingError } from "@/lib/domain/training";

// Оқыту папкасына PDF жүктеу: браузер файлды 3 МБ-тық бөліктерге бөліп, әрқайсысын осында жібереді
// (?folderId=&uploadId=&index=). Барлығы жеткен соң addTrainingFileAction материалды жасайды.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams;
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > TRAINING_CHUNK_BYTES) return NextResponse.json({ error: "fileInvalid" }, { status: 413 });

  try {
    const data = new Uint8Array(await request.arrayBuffer());
    await saveTrainingFileChunk(user.id, {
      folderId: q.get("folderId") ?? "",
      uploadId: q.get("uploadId") ?? "",
      index: Number(q.get("index")),
      data,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TrainingError) return NextResponse.json({ error: e.code }, { status: 400 });
    console.error("[training chunk]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "fileInvalid" }, { status: 500 });
  }
}
