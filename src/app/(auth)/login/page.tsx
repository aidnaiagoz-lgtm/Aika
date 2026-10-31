import { Logo } from "@/lib/ui";
import { loginAction } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  empty: "Email және құпиясөзді толтырыңыз",
  invalid: "Қате email немесе құпиясөз",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="shadow-card w-full max-w-sm rounded-card bg-surface p-8">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>

      <form action={loginAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-text-primary">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-icon border border-border bg-page-bg px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-text-primary">
            Құпиясөз
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-icon border border-border bg-page-bg px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {error && (
          <p className="rounded-icon bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {ERROR_MESSAGES[error] ?? "Кіру мүмкін болмады"}
          </p>
        )}

        <button
          type="submit"
          className="mt-2 rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Кіру
        </button>
      </form>
    </div>
  );
}
