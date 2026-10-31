// AutoMax брендінің нақты логотипі — қаріппен қайталап терудің орнына,
// сіз берген PDF-тен алынған дәл өз сурет-активі рендерленеді
// (apps/web/public/automax-logo-full.png), сондықтан қаріп сәйкес
// келмеу мәселесі мүлдем болмайды.
export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/automax-logo-full.png" alt="AUTO MAX — Защитим ваш салон" className="h-auto w-full max-w-[170px]" />
    </div>
  );
}
