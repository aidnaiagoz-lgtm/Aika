// Deploy кезінде іске қосылады: база бос болса ғана demo деректерді жүктейді.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.count();
  await prisma.$disconnect();
  if (users > 0) {
    console.log(`Seed өткізілді: базада ${users} қолданушы бар.`);
    return;
  }
  console.log("База бос — demo деректер жүктелуде...");
  await import("./seed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
