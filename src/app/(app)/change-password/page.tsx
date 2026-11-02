import { getCurrentUser } from "@/lib/auth";
import { changePasswordAction } from "./actions";

const ERRORS: Record<string, string> = {
  current: "Қазіргі пароль қате",
  short: "Жаңа пароль кемінде 8 таңба болуы керек",
  mismatch: "Жаңа парольдер сәйкес келмейді",
  same: "Жаңа пароль ескісінен өзгеше болуы керек",
};

const inputCls =
  "rounded-icon border border-border bg-page-bg px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <div className="shadow-card rounded-card bg-surface p-8">
        <h1 className="text-xl font-bold text-text-primary">🔑 Парольді өзгерту</h1>
        {user.mustChangePassword && (
          <p className="mt-3 rounded-icon bg-[#e8efff] px-3.5 py-2.5 text-sm text-[#1f4fd8]">
            Сізге уақытша пароль берілген. Жалғастыру үшін өз пароліңізді қойыңыз — оны тек сіз білесіз.
          </p>
        )}
        <form action={changePasswordAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
            {user.mustChangePassword ? "Уақытша пароль" : "Қазіргі пароль"}
            <input name="current" type="password" required autoComplete="current-password" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
            Жаңа пароль (кемінде 8 таңба)
            <input name="next" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
            Жаңа парольді қайталаңыз
            <input name="repeat" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
          </label>
          {error && (
            <p className="rounded-icon bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{ERRORS[error] ?? "Қате"}</p>
          )}
          <button
            type="submit"
            className="mt-2 rounded-pill bg-[#1f4fd8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a43b8]"
          >
            Сақтау
          </button>
        </form>
      </div>
    </div>
  );
}
