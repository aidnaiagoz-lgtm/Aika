import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { listManagers } from "@/lib/domain/managers";
import { displayLogin } from "@/lib/access";
import { CreateManagerForm, ResetPasswordButton, ConfirmButton } from "./ManagerForms";
import { toggleBlockAction, archiveAction, deleteAction } from "./actions";

export default async function ManagersPage({ searchParams }: { searchParams: Promise<{ view?: string; msg?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isLeader(user)) redirect("/rating");

  const sp = await searchParams;
  const archiveView = sp.view === "archive";
  const all = await listManagers();
  const archivedCount = all.filter((m) => m.user.status === "ARCHIVED").length;
  const managers = all.filter((m) => (archiveView ? m.user.status === "ARCHIVED" : m.user.status !== "ARCHIVED"));
  const fmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">👥 Менеджерлер</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Әр менеджердің өз логині мен паролі бар. Менеджер тек өз сатылымдарын өзгерте алады, басқалардың жолдары оған құлыпталған.
        </p>
      </div>

      <div className="shadow-card rounded-card bg-surface p-5">
        <h2 className="mb-4 text-base font-semibold text-text-primary">＋ Жаңа менеджер</h2>
        <CreateManagerForm />
      </div>

      <div className="shadow-card rounded-card bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link
            href="/managers"
            className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold ${!archiveView ? "bg-[#0b1a45] text-white" : "border border-border text-text-secondary"}`}
          >
            Белсенді · {all.length - archivedCount}
          </Link>
          <Link
            href="/managers?view=archive"
            className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold ${archiveView ? "bg-[#0b1a45] text-white" : "border border-border text-text-secondary"}`}
          >
            Жұмыстан шыққандар · {archivedCount}
          </Link>
        </div>
        {sp.msg && (
          <p className={`mb-3 rounded-xl px-3.5 py-2.5 text-sm ${sp.msg === "deleted" ? "bg-[#e7f7ec] text-[#15803d]" : "bg-danger/10 text-danger"}`}>
            {sp.msg === "deleted" ? "Аккаунт толық өшірілді" : sp.msg}
          </p>
        )}
        {archiveView && (
          <p className="mb-3 text-xs text-text-secondary">
            Жұмыстан шыққандар жүйеге кіре алмайды және рейтингте көрінбейді, бірақ сатылымдары тарихта сақталады.
            «Толық өшіру» — тек бір де бір сатылымы жоқ аккаунттарға (қате ашылған, тест).
          </p>
        )}
        {managers.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-secondary">{archiveView ? "Архив бос." : "Әзірге менеджер жоқ — жоғарыдағы формамен қосыңыз."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="py-2 pr-3">Аты</th>
                  <th className="py-2 pr-3">Логин</th>
                  <th className="py-2 pr-3">Рөлі</th>
                  <th className="py-2 pr-3">Соңғы кіру</th>
                  <th className="py-2 pr-3">Күйі</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => {
                  const blocked = m.user.status === "SUSPENDED";
                  const archived = m.user.status === "ARCHIVED";
                  const senior = m.user.userRoles.some((r) => r.role.name === "SENIOR_SALES_MANAGER");
                  return (
                    <tr key={m.id} className="border-b border-border align-top last:border-0">
                      <td className="py-3 pr-3 font-semibold text-text-primary">{m.fullName}</td>
                      <td className="py-3 pr-3 font-mono text-text-primary">
                        {displayLogin(m.user)}
                      </td>
                      <td className="py-3 pr-3 text-text-secondary">{senior ? "Аға менеджер" : "Менеджер"}</td>
                      <td className="py-3 pr-3 text-text-secondary">
                        {m.user.lastLoginAt ? fmt.format(m.user.lastLoginAt) : "—"}
                        {m.user.mustChangePassword && (
                          <div className="text-xs text-[#b7791f]">уақытша пароль әлі ауыстырылмаған</div>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                            archived ? "bg-page-bg text-text-secondary" : blocked ? "bg-danger/10 text-danger" : "bg-[#e7f7ec] text-[#16a34a]"
                          }`}
                        >
                          {archived ? "Жұмыстан шықты" : blocked ? "Бұғатталған" : "Белсенді"}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-start justify-end gap-2">
                          {archived ? (
                            <>
                              <ConfirmButton
                                action={archiveAction}
                                fields={{ userId: m.userId, archive: "0" }}
                                label="Қалпына келтіру"
                                confirmText={`${m.fullName} қайта жұмысқа қабылдансын ба? Аккаунты ашылады.`}
                              />
                              <ConfirmButton
                                action={deleteAction}
                                fields={{ userId: m.userId }}
                                label="Толық өшіру"
                                danger
                                confirmText={`${m.fullName} аккаунтын ТОЛЫҚ өшіру керек пе? Бұл әрекетті қайтару мүмкін емес.`}
                              />
                            </>
                          ) : (
                            <>
                              <ResetPasswordButton userId={m.userId} />
                              <form action={toggleBlockAction}>
                                <input type="hidden" name="userId" value={m.userId} />
                                <input type="hidden" name="block" value={blocked ? "0" : "1"} />
                                <button
                                  type="submit"
                                  className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-page-bg"
                                >
                                  {blocked ? "Ашу" : "Бұғаттау"}
                                </button>
                              </form>
                              <ConfirmButton
                                action={archiveAction}
                                fields={{ userId: m.userId, archive: "1" }}
                                label="Жұмыстан шықты"
                                danger
                                confirmText={`${m.fullName} жұмыстан шықты ма? Аккаунты жабылады, рейтингтен жоғалады, сатылымдары тарихта қалады.`}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
