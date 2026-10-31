"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-pill bg-page-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-border print:hidden"
    >
      {label}
    </button>
  );
}
