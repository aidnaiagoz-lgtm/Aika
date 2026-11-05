"use client";

// Беттегі күтпеген қате — ақ бет орнына түсінікті хабар және «Қайта ашу» батырмасы.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-[20px] border border-border bg-surface p-8 text-center">
      <h2 className="text-lg font-semibold text-text-primary">Бет ашылмай қалды</h2>
      <p className="text-sm text-text-secondary">
        Сайт жаңарған болуы мүмкін немесе байланыс үзілді. Бетті қайта ашыңыз — енгізілген деректер сақталған.
      </p>
      {error.digest && <p className="text-xs text-text-secondary">Код: {error.digest}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-[#1f4fd8] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1a43b8]"
        >
          Қайта ашу
        </button>
        <button type="button" onClick={reset} className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-text-primary">
          Қайталап көру
        </button>
      </div>
    </div>
  );
}
