import { del } from "@vercel/blob";
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
  | "fileInvalid"
  | "storageMissing";

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

/** PDF шегі: 50 МБ. Қоймаға тікелей браузерден жүктеледі (Vercel-дің 4.5 МБ шегі әсер етпейді). */
export const TRAINING_PDF_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Vercel Blob токені. Әдетте BLOB_READ_WRITE_TOKEN, бірақ қойманы жобаға қосқанда
 * басқа префикс таңдалса (мыс. AUTOMAX_FILES_READ_WRITE_TOKEN) — мәні "vercel_blob_rw_" деп басталатын кез келген айнымалы.
 */
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith("READ_WRITE_TOKEN") && value?.startsWith("vercel_blob_rw_")) return value;
  }
  return undefined;
}

/** Файл қоймасы (Vercel Blob) қосылған ба. */
export const isFileStorageConfigured = () => Boolean(blobToken());

/** Тек біздің қоймадағы training/<folderId>/ жолы — бөтен сілтемені «файл» деп сақтатпаймыз. */
export function isOwnTrainingBlobUrl(raw: string, folderId: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.startsWith(`/training/${folderId}/`);
  } catch {
    return false;
  }
}

export async function addTrainingFile(userId: string, folderId: string, title: string, url: string, fileName: string, fileSize: number) {
  const folder = await prisma.trainingFolder.findUnique({ where: { id: folderId }, select: { id: true } });
  if (!folder) throw new TrainingError("folderNotFound");
  if (!isOwnTrainingBlobUrl(url, folderId)) throw new TrainingError("fileInvalid");
  if (!/\.pdf$/i.test(fileName)) throw new TrainingError("fileNotPdf");
  if (!Number.isFinite(fileSize) || fileSize <= 0) throw new TrainingError("fileInvalid");
  if (fileSize > TRAINING_PDF_MAX_BYTES) throw new TrainingError("fileTooLarge");
  const cleanFileName = fileName.trim().slice(0, 200);
  const cleanTitle = title.trim().replace(/\s+/g, " ").slice(0, 200) || cleanFileName.replace(/\.pdf$/i, "");
  return prisma.trainingMaterial.create({
    data: { folderId, kind: "pdf", title: cleanTitle, url, fileName: cleanFileName, fileSize: Math.round(fileSize), createdById: userId },
  });
}

export async function deleteTrainingMaterial(user: Actor, id: string) {
  const m = await prisma.trainingMaterial.findUnique({ where: { id } });
  if (!m) throw new TrainingError("materialNotFound");
  if (!canManage(user, m.createdById)) throw new TrainingError("materialForbidden");
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
  // Қоймадағы файлды да өшіреміз; сәтсіз болса — материал бәрібір өшті, тек логқа жазамыз.
  if (m.kind === "pdf" && isFileStorageConfigured()) {
    await del(m.url, { token: blobToken() }).catch((e) => console.error("[training] blob delete", e instanceof Error ? e.message : e));
  }
  return m;
}
