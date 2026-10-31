"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Minus, Plus, UserRound } from "lucide-react";
import type { OrgNode } from "@/lib/i18n";

export function OrgChart({ node }: { node: OrgNode }) {
  const [zoom, setZoom] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLUListElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Айналасына бос кеңістік (px-[50vw] py-[50vh]) қосылған соң, бет жүктелгенде
  // scrollLeft/scrollTop әдепкі бойынша 0-ден басталады — бұл диаграмманы сол
  // бос орынның шетіне ығыстырады. Бет алғаш ашылғанда шрифт/мазмұн әлі толық
  // жүктеліп болмағандықтан ағаштың өлшемі бірнеше рет өзгереді — сол сайын
  // қайта ортаға келтіріп отырамыз (ResizeObserver), өлшем тұрақталғанда немесе
  // пайдаланушы өзі тартқан/масштабтаған кезде бұл тоқтайды.
  const userInteractedRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    const tree = treeRef.current;
    if (!el || !tree) return;

    function center() {
      if (userInteractedRef.current || !el || !tree) return;
      const elRect = el.getBoundingClientRect();
      const treeRect = tree.getBoundingClientRect();
      el.scrollLeft += treeRect.left - elRect.left - (elRect.width - treeRect.width) / 2;
      el.scrollTop += treeRect.top - elRect.top - (elRect.height - treeRect.height) / 2;
    }

    center();
    const observer = new ResizeObserver(center);
    observer.observe(tree);
    const stopTimer = setTimeout(() => observer.disconnect(), 3000);
    return () => {
      observer.disconnect();
      clearTimeout(stopTimer);
    };
  }, []);

  // Тышқан, трекпад, сенсорлық экран — бәрінде бірдей жұмыс істеу үшін Pointer
  // Events қолданылады (бір ғана API). setPointerCapture нүктені контейнерге
  // "бекітеді" — курсор контейнер шекарасынан шықса да жылжыту үзілмейді.
  const dragStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (!el || e.button > 0) return;
    userInteractedRef.current = true;
    el.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    setIsDragging(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = scrollRef.current;
    const start = dragStart.current;
    if (!el || !start) return;
    // transform: scale() курсордың экрандағы жылжуын масштабтамайды (CSS
    // layout өлшемі өзгермейді), сондықтан scrollLeft-ке қолданар алдында
    // zoom коэффициентіне бөлу керек — әйтпесе кішірейткенде тым жылдам,
    // үлкейткенде тым баяу жылжиды.
    const factor = zoom / 100;
    el.scrollLeft = start.scrollLeft - (e.clientX - start.x) / factor;
    el.scrollTop = start.scrollTop - (e.clientY - start.y) / factor;
  }
  function onPointerUp(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (el) el.releasePointerCapture(e.pointerId);
    dragStart.current = null;
    setIsDragging(false);
  }

  // Батырмамен жылжыту — ұстап тарту кейбір құрылғыда/браузерде жұмыс
  // істемесе де, бұл әрдайым сенімді (жай ғана басу, ұстау емес).
  function pan(dx: number, dy: number) {
    userInteractedRef.current = true;
    scrollRef.current?.scrollBy({ left: dx, top: dy, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className={`org-tree-outer h-[75vh] overflow-auto touch-none ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <style>{`
          .org-tree-outer { display: flex; justify-content: safe center; align-items: flex-start; }
          .org-tree .org-branches { display: flex; justify-content: safe center; padding-top: 22px; position: relative; margin: 0; }
          .org-tree .org-branches > li { list-style: none; position: relative; padding: 22px 4px 0 4px; text-align: center; flex-shrink: 0; }
          .org-tree .org-branches > li::before, .org-tree .org-branches > li::after {
            content: ""; position: absolute; top: 0; right: 50%;
            border-top: 2px solid #b3b9c6; width: 50%; height: 22px;
          }
          .org-tree .org-branches > li::after { right: auto; left: 50%; border-left: 2px solid #b3b9c6; }
          .org-tree .org-branches > li:only-child { padding-top: 0; }
          .org-tree .org-branches > li:only-child::before, .org-tree .org-branches > li:only-child::after { display: none; }
          .org-tree .org-branches > li:first-child::before { border: none; }
          .org-tree .org-branches > li:last-child::after { border: none; }
          .org-tree .org-branches > li:first-child::after { border-radius: 8px 0 0 0; }
          .org-tree .org-branches > li:last-child::before { border-right: 2px solid #b3b9c6; border-radius: 0 8px 0 0; }
          .org-tree .org-branches .org-branches::before {
            content: ""; position: absolute; top: 0; left: 50%;
            border-left: 2px solid #b3b9c6; width: 0; height: 22px;
          }
        `}</style>
        <div
          className="org-tree shrink-0 px-[50vw] py-[50vh]"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
        >
          <ul ref={treeRef} className="org-branches">
            <OrgTreeNode node={node} depth={0} />
          </ul>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-10 flex flex-col items-center gap-2">
        <div className="grid grid-cols-3 grid-rows-3 gap-0.5 rounded-icon border border-border bg-surface p-1.5 shadow-card">
          <div />
          <PanButton onClick={() => pan(0, -200)}>
            <ArrowUp size={14} />
          </PanButton>
          <div />
          <PanButton onClick={() => pan(-200, 0)}>
            <ArrowLeft size={14} />
          </PanButton>
          <div />
          <PanButton onClick={() => pan(200, 0)}>
            <ArrowRight size={14} />
          </PanButton>
          <div />
          <PanButton onClick={() => pan(0, 200)}>
            <ArrowDown size={14} />
          </PanButton>
          <div />
        </div>
        <div className="flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-2 shadow-card">
          <button
            type="button"
            aria-label="-"
            onClick={() => {
              userInteractedRef.current = true;
              setZoom((z) => Math.max(10, z - 5));
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-page-bg"
          >
            <Minus size={14} />
          </button>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={zoom}
            onChange={(e) => {
              userInteractedRef.current = true;
              setZoom(Number(e.target.value));
            }}
            className="w-28 accent-accent"
          />
          <button
            type="button"
            aria-label="+"
            onClick={() => {
              userInteractedRef.current = true;
              setZoom((z) => Math.min(100, z + 5));
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-page-bg"
          >
            <Plus size={14} />
          </button>
          <span className="w-10 text-right text-xs font-semibold tabular-nums text-text-primary">{zoom}%</span>
        </div>
      </div>
    </div>
  );
}

function PanButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-icon text-text-secondary hover:bg-page-bg"
    >
      {children}
    </button>
  );
}

function OrgTreeNode({ node, depth }: { node: OrgNode; depth: number }) {
  const isVacant = node.name === "ФИО";
  const cardClass = isVacant
    ? "border border-danger/40 bg-danger/10 text-danger"
    : depth === 0
      ? "bg-accent text-white"
      : depth === 1
        ? "bg-accent-tint text-accent"
        : "border border-border bg-surface text-text-primary";

  return (
    <li>
      <div className={`inline-block whitespace-nowrap rounded-icon px-2.5 py-2 text-left shadow-card ${cardClass}`}>
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {node.person && <UserRound size={12} className="shrink-0 opacity-80" />}
          {node.name}
        </div>
        {node.roles && node.roles.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5 border-t border-current/15 pt-1">
            {node.roles.map((role, i) => (
              <li key={`${role}-${i}`} className="text-[10px] font-normal opacity-80">
                {role}
              </li>
            ))}
          </ul>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <ul className="org-branches">
          {node.children.map((child, i) => (
            <OrgTreeNode key={`${child.name}-${i}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
