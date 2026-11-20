import { prisma } from "@/lib/db";
import { isLeader } from "@/lib/access";

export type TrainingSection = "qualification" | "provision";

export const TRAINING_SECTIONS: TrainingSection[] = ["qualification", "provision"];

export function isTrainingSection(v: string): v is TrainingSection {
  return (TRAINING_SECTIONS as string[]).includes(v);
}

export type TrainingErrorCode =
  | "nameRequired"
  | "nameTooLong"
  | "folderNotFound"
  | "folderForbidden"
  | "folderNotEmpty"
  | "urlRequired"
  | "urlInvalid"
  | "urlProtocol"
  | "materialNotFound"
  | "materialForbidden"
  | "fileNotPdf"
  | "fileTooLarge"
  | "fileInvalid";

/** Пайдаланушыға көрсетілетін қате — мәтіні i18n-де (t.training.errors[code]), тіл ауысқанда да дұрыс шығады. */
export class TrainingError extends Error {
  constructor(public readonly code: TrainingErrorCode) {
    super(code);
  }
}

type Actor = Parameters<typeof isLeader>[0] & { id: string };

/** Атын өзгерту / өшіру — тек құрған адам немесе басшы (CEO, ADMIN, бөлім бастығы). */
export function canManage(user: Actor, createdById: string) {
  return user.id === createdById || isLeader(user);
}

const cleanName = (name: string) => {
  const s = name.trim().replace(/\s+/g, " ");
  if (!s) throw new TrainingError("nameRequired");
  if (s.length > 120) throw new TrainingError("nameTooLong");
  return s;
};

export async function listTrainingFolders(section: TrainingSection, parentId: string | null = null) {
  return prisma.trainingFolder.findMany({
    where: { section, parentId },
    include: {
      createdBy: { include: { employee: true } },
      _count: { select: { children: true, materials: true } },
    },
    orderBy: { name: "asc" },
  });
}

/** Папка + оған дейінгі жол (жоғарыдан төмен). Басқа бөлімнің папкасы болса — null. */
export async function getTrainingFolder(section: TrainingSection, id: string) {
  const folder = await prisma.trainingFolder.findUnique({
    where: { id },
    include: {
      materials: { include: { createdBy: { include: { employee: true } } }, orderBy: { createdAt: "asc" } },
      _count: { select: { children: true, materials: true } },
    },
  });
  if (!folder || folder.section !== section) return null;

  const path: Array<{ id: string; name: string }> = [];
  let parentId = folder.parentId;
  for (let depth = 0; parentId && depth < 50; depth++) {
    const p = await prisma.trainingFolder.findUnique({ where: { id: parentId }, select: { id: true, name: true, parentId: true } });
    if (!p) break;
    path.unshift({ id: p.id, name: p.name });
    parentId = p.parentId;
  }
  return { folder, path };
}

export async function createTrainingFolder(userId: string, section: TrainingSection, name: string, parentId: string | null = null) {
  const clean = cleanName(name);
  if (parentId) {
    const parent = await prisma.trainingFolder.findUnique({ where: { id: parentId }, select: { section: true } });
    if (!parent || parent.section !== section) throw new TrainingError("folderNotFound");
  }
  return prisma.trainingFolder.create({ data: { section, name: clean, createdById: userId, parentId } });
}

async function folderForManage(user: Actor, id: string) {
  const folder = await prisma.trainingFolder.findUnique({
    where: { id },
    include: { _count: { select: { children: true, materials: true } } },
  });
  if (!folder) throw new TrainingError("folderNotFound");
  if (!canManage(user, folder.createdById)) throw new TrainingError("folderForbidden");
  return folder;
}

export async function renameTrainingFolder(user: Actor, id: string, name: string) {
  const folder = await folderForManage(user, id);
  const clean = cleanName(name);
  if (clean === folder.name) return folder;
  const updated = await prisma.trainingFolder.update({ where: { id }, data: { name: clean } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "UPDATE", entityType: "TrainingFolder", entityId: id, oldValue: { name: folder.name }, newValue: { name: clean } },
  });
  return updated;
}

/** Тек бос папка өшіріледі — ішіндегі материал кездейсоқ жоғалып кетпесін. */
export async function deleteTrainingFolder(user: Actor, id: string) {
  const folder = await folderForManage(user, id);
  if (folder._count.children > 0 || folder._count.materials > 0) {
    throw new TrainingError("folderNotEmpty");
  }
  await prisma.trainingFolder.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "DELETE", entityType: "TrainingFolder", entityId: id, oldValue: { name: folder.name, section: folder.section, parentId: folder.parentId } },
  });
  return folder;
}

export function normalizeUrl(raw: string): string {
  let s = raw.trim();
  if (!s) throw new TrainingError("urlRequired");
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new TrainingError("urlInvalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new TrainingError("urlProtocol");
  return url.toString();
}

export async function addTrainingLink(userId: string, folderId: string, title: string, rawUrl: string) {
  const url = normalizeUrl(rawUrl);
  const folder = await prisma.trainingFolder.findUnique({ where: { id: folderId }, select: { id: true } });
  if (!folder) throw new TrainingError("folderNotFound");
  const cleanTitle = title.trim().replace(/\s+/g, " ").slice(0, 200) || new URL(url).hostname.replace(/^www\./, "");
  return prisma.trainingMaterial.create({ data: { folderId, kind: "link", title: cleanTitle, url, createdById: userId } });
}

/** PDF шегі: 20 МБ. Файл сайттың өз базасында сақталады (бөлек файл қоймасы керек емес). */
export const TRAINING_PDF_MAX_BYTES = 20 * 1024 * 1024;
/** Бір бөлік — 3 МБ: Vercel бір сұранысқа 4.5 МБ-тан артық қабылдамайды. */
export const TRAINING_CHUNK_BYTES = 3 * 1024 * 1024;
export const TRAINING_MAX_CHUNKS = Math.ceil(TRAINING_PDF_MAX_BYTES / TRAINING_CHUNK_BYTES);

/** Браузер әр жүктеуге өзі жасайтын кездейсоқ белгі. */
export const isUploadId = (v: string) => /^[A-Za-z0-9_-]{16,64}$/.test(v);

/** Жүктелген бөліктер толық па: 0..n-1 рет-ретімен, соңғысынан басқасы толық 3 МБ, жалпы көлемі файлмен тең. */
export function chunksComplete(chunks: Array<{ index: number; size: number }>, fileSize: number) {
  if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > TRAINING_PDF_MAX_BYTES) return false;
  const expected = Math.ceil(fileSize / TRAINING_CHUNK_BYTES);
  if (chunks.length !== expected) return false;
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  return sorted.every((c, i) => {
    if (c.index !== i) return false;
    const want = i < expected - 1 ? TRAINING_CHUNK_BYTES : fileSize - TRAINING_CHUNK_BYTES * (expected - 1);
    return c.size === want;
  });
}

/** PDF файлдың бір бөлігін базаға жазу. Бірінші бөлік «%PDF-» деп басталуы керек — басқа файлды PDF деп салдырмаймыз. */
export async function saveTrainingFileChunk(userId: string, input: { folderId: string; uploadId: string; index: number; data: Uint8Array }) {
  const { folderId, uploadId, index, data } = input;
  if (!isUploadId(uploadId) || !Number.isInteger(index) || index < 0 || index >= TRAINING_MAX_CHUNKS) throw new TrainingError("fileInvalid");
  if (data.length === 0 || data.length > TRAINING_CHUNK_BYTES) throw new TrainingError("fileInvalid");
  if (index === 0 && Buffer.from(data.subarray(0, 5)).toString("latin1") !== "%PDF-") throw new TrainingError("fileNotPdf");
  const folder = await prisma.trainingFolder.findUnique({ where: { id: folderId }, select: { id: true } });
  if (!folder) throw new TrainingError("folderNotFound");
  const existing = await prisma.trainingFileChunk.findUnique({
    where: { uploadId_index: { uploadId, index } },
    select: { uploadedById: true, materialId: true },
  });
  if (existing && (existing.uploadedById !== userId || existing.materialId)) throw new TrainingError("fileInvalid");
  const bytes = Uint8Array.from(data);
  await prisma.trainingFileChunk.upsert({
    where: { uploadId_index: { uploadId, index } },
    create: { uploadId, index, data: bytes, uploadedById: userId },
    update: { data: bytes },
  });
}

/** Барлық бөлік жүктелген соң — материалды жасап, бөліктерді оған байлаймыз. */
export async function addTrainingFile(userId: string, folderId: string, title: string, uploadId: string, fileName: string, fileSize: number) {
  const folder = await prisma.trainingFolder.findUnique({ where: { id: folderId }, select: { id: true } });
  if (!folder) throw new TrainingError("folderNotFound");
  if (!isUploadId(uploadId)) throw new TrainingError("fileInvalid");
  if (!/\.pdf$/i.test(fileName)) throw new TrainingError("fileNotPdf");
  if (!Number.isFinite(fileSize) || fileSize <= 0) throw new TrainingError("fileInvalid");
  if (fileSize > TRAINING_PDF_MAX_BYTES) throw new TrainingError("fileTooLarge");

  // Көлемін ғана оқимыз (файлдың өзін жадқа жүктемей).
  const rows = await prisma.$queryRaw<Array<{ index: number; size: number; uploadedById: string; materialId: string | null }>>`
    SELECT "index", octet_length("data")::int AS "size", "uploadedById", "materialId"
    FROM "training_file_chunks" WHERE "uploadId" = ${uploadId}`;
  if (rows.some((r) => r.uploadedById !== userId || r.materialId)) throw new TrainingError("fileInvalid");
  if (!chunksComplete(rows, fileSize)) throw new TrainingError("fileInvalid");

  const cleanFileName = fileName.trim().slice(0, 200);
  const cleanTitle = title.trim().replace(/\s+/g, " ").slice(0, 200) || cleanFileName.replace(/\.pdf$/i, "");
  const material = await prisma.$transaction(async (tx) => {
    const m = await tx.trainingMaterial.create({
      data: { folderId, kind: "pdf", title: cleanTitle, url: `db:${uploadId}`, fileName: cleanFileName, fileSize: Math.round(fileSize), createdById: userId },
    });
    await tx.trainingFileChunk.updateMany({ where: { uploadId }, data: { materialId: m.id } });
    return m;
  });
  // Аяқталмай қалған ескі жүктеулер (1 тәуліктен асқан) — тазалаймыз.
  await prisma.trainingFileChunk
    .deleteMany({ where: { materialId: null, createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
    .catch((e) => console.error("[training] chunk cleanup", e instanceof Error ? e.message : e));
  return material;
}

export async function deleteTrainingMaterial(user: Actor, id: string) {
  const m = await prisma.trainingMaterial.findUnique({ where: { id } });
  if (!m) throw new TrainingError("materialNotFound");
  if (!canManage(user, m.createdById)) throw new TrainingError("materialForbidden");
  // PDF бөліктері де бірге өшеді (onDelete: Cascade).
  await prisma.trainingMaterial.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "DELETE",
      entityType: "TrainingMaterial",
      entityId: id,
      oldValue: { kind: m.kind, title: m.title, url: m.url, fileName: m.fileName, folderId: m.folderId },
    },
  });
  return m;
}
