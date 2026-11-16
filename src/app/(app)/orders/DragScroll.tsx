"use client";

import { useRef } from "react";

/**
 * Кестені тышқанмен «ұстап» жылжыту (CEO, 2026-11-16): курсор — қол, батырманы басып тартса — кесте оңға/солға
 * (және жоғары/төмен) жылжиды. 5px-тен аз қозғалса — кәдімгі басу (сілтемелер жұмыс істей береді).
 */
export function DragScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !ref.current) return;
    // Енгізу өрістері мен батырмаларда кәдімгідей
    if ((e.target as HTMLElement).closest("input, textarea, select, button, summary")) return;
    drag.current = { x: e.clientX, y: e.clientY, left: ref.current.scrollLeft, top: ref.current.scrollTop, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
    }
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  };
  const end = () => {
    const el = ref.current;
    if (el) {
      el.style.cursor = "";
      el.style.userSelect = "";
    }
    // Тартып болғаннан кейінгі «click» сілтемені ашып жібермесін
    if (drag.current?.moved) {
      const stop = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
    }
    drag.current = null;
  };

  return (
    <div ref={ref} className={`cursor-grab ${className ?? ""}`} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={end} onMouseLeave={end}>
      {children}
    </div>
  );
}
