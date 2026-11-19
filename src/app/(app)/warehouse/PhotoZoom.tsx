"use client";

import { useState } from "react";

/**
 * Кішкене фото: тышқанды үстіне апарғанда үлкейтіп көрсетеді (CEO, 2026-11-19).
 * Үлкен сурет `position: fixed` — кестенің overflow-ы кесіп тастамайды; экраннан шықпайтындай орналасады.
 */
export function PhotoZoom({ src, alt, size = 40, className = "", rounded = 10 }: { src: string; alt: string; size?: number; className?: string; rounded?: number }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const W = 260;
  const H = 340;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- базадан келетін кішкене сурет */}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        className={`shrink-0 cursor-zoom-in object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.06)] ${className}`}
        style={{ width: size, height: size, borderRadius: rounded }}
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const right = r.right + 12 + W <= window.innerWidth;
          const left = right ? r.right + 12 : Math.max(8, r.left - 12 - W);
          const top = Math.min(Math.max(8, r.top + r.height / 2 - H / 2), window.innerHeight - H - 8);
          setPos({ left, top });
        }}
        onMouseLeave={() => setPos(null)}
      />
      {pos && (
        <span
          className="pointer-events-none fixed z-[100] overflow-hidden rounded-[16px] bg-surface p-1.5 shadow-[0_12px_40px_rgba(16,24,40,0.25)]"
          style={{ left: pos.left, top: pos.top, width: W, height: H }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- үлкейтілген көрініс */}
          <img src={src} alt={alt} className="h-full w-full rounded-[12px] object-cover" />
          <span className="absolute inset-x-1.5 bottom-1.5 rounded-b-[12px] bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">{alt}</span>
        </span>
      )}
    </>
  );
}
