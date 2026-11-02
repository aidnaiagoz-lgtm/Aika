import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { ImportClient } from "./ImportClient";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isLeader(user)) redirect("/rating");

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Excel импорт</h1>
        <p className="mt-1 text-sm text-text-secondary">
          «Продажи» кестесін сайтқа көшіру. Соңғы 30 күнде жұмыс істеген менеджерлерге аккаунт автоматты ашылады,
          рейтинг бірден есептеледі. Тек CEO мен РОП.
        </p>
      </div>
      <ImportClient />
    </div>
  );
}
