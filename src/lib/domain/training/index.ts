import { prisma } from "@/lib/db";

export type TrainingSection = "qualification" | "provision";

export async function listTrainingFolders(section: TrainingSection) {
  return prisma.trainingFolder.findMany({
    where: { section },
    include: { createdBy: { include: { employee: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTrainingFolder(userId: string, section: TrainingSection, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Папка атауын енгізіңіз");
  return prisma.trainingFolder.create({
    data: { section, name: trimmed, createdById: userId },
  });
}
