"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Lock, Plus, Search } from "lucide-react";
import { SHEET_WIDTHS, SHEET_THICK_RIGHT, SHEET_HEADERS, COMPUTED_FIELDS, rowColor, columnLetter } from "@/lib/domain/sales-ledger/sheet-layout";
import type { ClientRow } from "./client-row";
import { updateCellAction, addRowAction } from "./sheet-actions";

// Google Sheets-ке ұқсас кесте: 45 баған (A..AS), таблицадағы ені/түстері, ұяшықты басып өзгерту,
// жебелер / Enter / Tab / Esc, ашылмалы тізімдер. Тек көрінетін жолдар салынады (виртуализация).

type Col = { name: string; type: string };

const ROW_H = 22;
const HEAD_H = 40;
const LETTER_H = 20;
const NUM_W = 46;
const OVERSCAN = 15;

const fmtNum = new Intl.NumberFormat("ru-RU");

function display(type: string, v: string | number | null, name: string): string {
  if (v === null || v === "") return "";
  if (type === "date" && typeof v === "string") {
    const d = v.slice(0, 10).split("-");
    return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : v;
  }
  if (type === "datetime-local" && typeof v === "string") {
    const d = new Date(new Date(v).getTime() + 5 * 3600_000).toISOString();
    return `${d.slice(8, 10)},${d.slice(5, 7)},${d.slice(2, 4)} ${d.slice(11, 13)}-${d.slice(14, 16)}`;
  }
  if (typeof v === "number") {
    if (name === "remainder" && v === 0) return "Төленді";
    if (["no", "year", "carYear", "pocketsPairs"].includes(name)) return String(v);
    return fmtNum.format(v);
  }
  if (v === "true") return "☑";
  if (v === "false") return "☐";
  return String(v);
}

function editValue(type: string, v: string | number | null): string {
  if (v === null) return "";
  if (type === "date" && typeof v === "string") return v.slice(0, 10);
  if (type === "datetime-local" && typeof v === "string") return new Date(new Date(v).getTime() + 5 * 3600_000).toISOString().slice(0, 16);
  return String(v);
}

export function SheetGrid({
  columns,
  initialRows,
  options,
  priceByProduct,
  canAdd,
  readOnlyReason,
  sheetUrl,
  canSwitchSource,
}: {
  columns: Col[];
  initialRows: ClientRow[];
  options: Record<string, string[]>;
  priceByProduct: Record<string, number>;
  canAdd: boolean;
  readOnlyReason: string | null;
  sheetUrl: string | null;
  canSwitchSource: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [howTo, setHowTo] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [edit, setEditState] = useState<{ r: number; c: number; value: string } | null>(null);
  // Синхронды көшірме: редактор ашылып үлгергенше жылдам басылған әріптер жоғалмауы үшін
  const editRef = useRef<{ r: number; c: number; value: string } | null>(null);
  const setEdit = useCallback((v: { r: number; c: number; value: string } | null) => {
    editRef.current = v;
    setEditState(v);
  }, []);
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const [saving, setSaving] = useState(0);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Көрінбейтін енгізу өрісі (Google Sheets сияқты): таңдалған ұяшықта тұрады, кез келген мәтінді ұстайды
  // (кириллица, IME, телефон пернетақтасы) — keydown жібермейтін енгізулерде де әріп жоғалмайды.
  const catcherRef = useRef<HTMLInputElement>(null);
  const focusGrid = () => catcherRef.current?.focus({ preventScroll: true });
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);

  useEffect(() => setRows(initialRows), [initialRows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.values.some((v) => v !== null && String(v).toLowerCase().includes(q)));
  }, [rows, query]);

  const lefts = useMemo(() => {
    const out: number[] = [];
    let x = NUM_W;
    for (const w of SHEET_WIDTHS) {
      out.push(x);
      x += w;
    }
    return { out, total: x };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const last = Math.min(visibleRows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);

  const flash = (text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast(null), bad ? 4000 : 1500);
  };

  const cellEditable = useCallback(
    (r: number, c: number) => {
      const row = visibleRows[r];
      return !readOnlyReason && !!row?.editable && !COMPUTED_FIELDS.has(columns[c].name);
    },
    [visibleRows, columns, readOnlyReason]
  );

  const ensureVisible = useCallback((r: number, c: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const top = r * ROW_H;
    const bottom = top + ROW_H + LETTER_H + HEAD_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    const left = lefts.out[c];
    const right = left + SHEET_WIDTHS[c];
    if (left - NUM_W < el.scrollLeft) el.scrollLeft = left - NUM_W;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
  }, [lefts]);

  const move = useCallback(
    (dr: number, dc: number) => {
      setSel((s) => {
        const cur = s ?? { r: 0, c: 0 };
        const r = Math.min(Math.max(cur.r + dr, 0), Math.max(visibleRows.length - 1, 0));
        const c = Math.min(Math.max(cur.c + dc, 0), columns.length - 1);
        ensureVisible(r, c);
        return { r, c };
      });
    },
    [visibleRows.length, columns.length, ensureVisible]
  );

  const commit = useCallback(
    (r: number, c: number, value: string) => {
      const row = visibleRows[r];
      const col = columns[c];
      setEdit(null);
      if (!row) return;
      const before = editValue(col.type, row.values[c]);
      if (value === before) return;
      // Оптимистік көрініс
      const optimistic = row.values.slice();
      optimistic[c] = value === "" ? null : col.type === "number" ? Number(value.replace(/\s/g, "").replace(",", ".")) : value;
      setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, values: optimistic } : x)));
      setSaving((n) => n + 1);
      startTransition(async () => {
        const res = await updateCellAction(row.id, col.name, value);
        setSaving((n) => n - 1);
        if (res.ok) {
          setRows((rs) => rs.map((x) => (x.id === row.id ? res.row : x)));
          // Тауар таңдалса — бағасы бос болса, соңғы бағасын қоямыз (таблицадағы VLOOKUP сияқты)
          if (col.name === "product" && value && priceByProduct[value] != null) {
            const pi = columns.findIndex((x) => x.name === "price");
            if (pi >= 0 && res.row.values[pi] == null) {
              const r2 = await updateCellAction(row.id, "price", String(priceByProduct[value]));
              if (r2.ok) setRows((rs) => rs.map((x) => (x.id === row.id ? r2.row : x)));
            }
          }
        } else {
          setRows((rs) => rs.map((x) => (x.id === row.id ? row : x)));
          flash(res.error, true);
        }
      });
    },
    [visibleRows, columns, priceByProduct]
  );

  const startEdit = (r: number, c: number, initial?: string) => {
    if (!cellEditable(r, c)) {
      const row = visibleRows[r];
      if (readOnlyReason) flash(readOnlyReason, true);
      else if (row && !row.editable) flash("🔒 Бұл жолды тек оны енгізген менеджер өзгерте алады", true);
      else flash("Бұл баған өздігінен толады", true);
      return;
    }
    setEdit({ r, c, value: initial ?? editValue(columns[c].type, visibleRows[r].values[c]) });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const pending = editRef.current;
    if (pending) {
      // Редактор әлі фокус алмаған — әріптерді onCatcherInput қосады
      if (e.key === "Backspace") {
        e.preventDefault();
        setEdit({ ...pending, value: pending.value.slice(0, -1) });
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        commit(pending.r, pending.c, pending.value);
        if (e.key === "Enter") move(1, 0);
        else move(0, e.shiftKey ? -1 : 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEdit(null);
      }
      return;
    }
    if (!sel) return;
    if (e.key === "ArrowDown") (e.preventDefault(), move(1, 0));
    else if (e.key === "ArrowUp") (e.preventDefault(), move(-1, 0));
    else if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) (e.preventDefault(), move(0, 1));
    else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) (e.preventDefault(), move(0, -1));
    else if (e.key === "Enter" || e.key === "F2") (e.preventDefault(), startEdit(sel.r, sel.c));
    else if (e.key === "Delete" || e.key === "Backspace") {
      if (cellEditable(sel.r, sel.c)) (e.preventDefault(), commit(sel.r, sel.c, ""));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const t = columns[sel.c].type;
      // Мәтін/сан — әріпті onInput ұстайды; күн бағандарында редакторды бірден ашамыз
      if (t !== "text" && t !== "number") (e.preventDefault(), startEdit(sel.r, sel.c));
    }
  };

  const onCatcherInput = (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const text = el.value;
    el.value = "";
    if (!text || !sel) return;
    const pending = editRef.current;
    if (pending) setEdit({ ...pending, value: pending.value + text });
    else startEdit(sel.r, sel.c, text);
  };

  const addRow = () => {
    startTransition(async () => {
      const res = await addRowAction();
      if (!res.ok) return flash(res.error, true);
      setQuery("");
      setRows((rs) => {
        const next = [...rs, res.row];
        // Таблицадағыдай — жаңа жол ең төменде
        window.setTimeout(() => {
          setSel({ r: next.length - 1, c: 5 });
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          focusGrid();
        }, 0);
        return next;
      });
      flash("Жаңа жол қосылды — «Номер клиента» бағанынан бастаңыз");
    });
  };

  const totalH = LETTER_H + HEAD_H + visibleRows.length * ROW_H;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm">
          <Search size={15} className="text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Іздеу: телефон, клиент, авто, тауар…"
            className="w-full bg-transparent outline-none"
          />
        </div>
        <span className="text-xs text-text-secondary">
          {visibleRows.length} жол{saving > 0 ? " · сақталуда…" : " · ✓ сақталды"}
        </span>
        <button
          type="button"
          onClick={canAdd ? addRow : () => setHowTo((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-[#188038] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#137333]"
        >
          <Plus size={16} /> Жаңа сатылым
        </button>
      </div>

      {howTo && !canAdd && (
        <div className="rounded-xl border border-[#c6dafc] bg-[#f5f8ff] p-4 text-sm text-text-primary">
          <b>Жаңа сатылымды қазір қайда толтырамын?</b>
          <p className="mt-1 text-text-secondary">
            Қазір «Деректер көзі» — <b>Google таблица</b>. Сатылымды бұрынғыдай Google таблицаға жазыңыз — ол осы бетке
            10 минут ішінде өзі түседі, рейтинг те өзі жаңарады.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#188038] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#137333]">
                Google таблицаны ашу ↗
              </a>
            )}
            {canSwitchSource && (
              <a href="/import#source" className="rounded-lg border border-[#1f4fd8] px-3.5 py-1.5 text-sm font-semibold text-[#1f4fd8] hover:bg-[#e8efff]">
                Сатылымды осы сайтта толтыруға көшу →
              </a>
            )}
          </div>
          {canSwitchSource && (
            <p className="mt-2 text-xs text-text-secondary">
              Көшкеннен кейін осы батырма бос жол ашады: Дата мен Менеджер өзі толады, қалғанын ұяшықты басып жазасыз (Enter / Tab).
            </p>
          )}
        </div>
      )}

      {readOnlyReason && (
        <div className="flex items-center gap-2 rounded-lg border border-[#f3e2b3] bg-[#fffaf0] px-3 py-2 text-xs text-[#8a5a00]">
          <Lock size={13} /> {readOnlyReason}
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        className="relative h-[calc(100vh-260px)] min-h-[420px] overflow-auto border border-[#c0c0c0] bg-white outline-none"
        style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11 }}
      >
        <div style={{ width: lefts.total, height: totalH, position: "relative" }}>
          {/* Баған әріптері A, B, C… */}
          <div className="sticky top-0 z-30 flex" style={{ height: LETTER_H, width: lefts.total }}>
            <div className="sticky left-0 z-40 border-b border-r border-[#c0c0c0] bg-[#f8f9fa]" style={{ width: NUM_W, minWidth: NUM_W }} />
            {columns.map((_, c) => (
              <div
                key={c}
                className={`flex items-center justify-center border-b border-r border-[#c0c0c0] text-[10px] ${sel?.c === c ? "bg-[#d3e3fd] font-bold text-[#0b57d0]" : "bg-[#f8f9fa] text-[#5f6368]"}`}
                style={{ width: SHEET_WIDTHS[c], minWidth: SHEET_WIDTHS[c] }}
              >
                {columnLetter(c)}
              </div>
            ))}
          </div>
          {/* Таблицадағы қара тақырып */}
          <div className="sticky z-30 flex" style={{ top: LETTER_H, height: HEAD_H, width: lefts.total }}>
            <div className="sticky left-0 z-40 flex items-center justify-center border-b border-r border-[#c0c0c0] bg-[#f8f9fa] text-[10px] text-[#5f6368]" style={{ width: NUM_W, minWidth: NUM_W }}>
              1
            </div>
            {columns.map((col, c) => (
              <div
                key={col.name}
                className="flex items-center justify-center whitespace-pre-line bg-black px-1 text-center text-[10px] font-bold leading-tight text-white"
                style={{
                  width: SHEET_WIDTHS[c],
                  minWidth: SHEET_WIDTHS[c],
                  borderRight: SHEET_THICK_RIGHT.has(c) ? "2px solid #000" : "1px solid #444",
                }}
              >
                {SHEET_HEADERS[c]}
              </div>
            ))}
          </div>

          <input
            ref={catcherRef}
            aria-label="Ұяшыққа жазу"
            autoComplete="off"
            onKeyDown={onKeyDown}
            onInput={onCatcherInput}
            className="absolute z-0 h-[22px] w-[2px] border-0 bg-transparent p-0 text-transparent caret-transparent outline-none"
            style={{
              top: LETTER_H + HEAD_H + (sel?.r ?? 0) * ROW_H,
              left: sel ? lefts.out[sel.c] : NUM_W,
              opacity: 0,
            }}
          />

          {/* Жолдар — тек көрінетіндері */}
          {visibleRows.slice(first, last).map((row, i) => {
            const r = first + i;
            const statusIdx = columns.findIndex((c) => c.name === "orderStatus");
            const bg = rowColor(row.values[statusIdx] as string | null);
            return (
              <div key={row.id} className="absolute flex" style={{ top: LETTER_H + HEAD_H + r * ROW_H, height: ROW_H, width: lefts.total }}>
                <div
                  className={`sticky left-0 z-20 flex items-center justify-center border-b border-r border-[#c0c0c0] text-[10px] ${sel?.r === r ? "bg-[#d3e3fd] font-bold text-[#0b57d0]" : "bg-[#f8f9fa] text-[#5f6368]"}`}
                  style={{ width: NUM_W, minWidth: NUM_W }}
                  title={row.editable ? "Сіздің жолыңыз" : "Тек оқу"}
                >
                  {row.editable ? r + 2 : <span className="flex items-center gap-0.5">{r + 2}<Lock size={8} /></span>}
                </div>
                {columns.map((col, c) => {
                  const isSel = sel?.r === r && sel?.c === c;
                  const isEdit = edit?.r === r && edit?.c === c;
                  const isNum = col.type === "number";
                  const cellBg = c === 0 ? "#f4c7c3" : col.name === "salesChannel" ? "#fff2cc" : col.name === "year" || col.name === "month" || col.name === "payments" ? "#ffffff" : bg;
                  return (
                    <div
                      key={col.name}
                      onMouseDown={(e) => {
                        if (isEdit) return;
                        e.preventDefault();
                        setSel({ r, c });
                        focusGrid();
                      }}
                      onDoubleClick={() => startEdit(r, c)}
                      className={`relative overflow-hidden whitespace-nowrap px-[3px] leading-[21px] ${isNum ? "text-right" : c <= 4 || col.name === "carYear" ? "text-center" : "text-left"}`}
                      style={{
                        width: SHEET_WIDTHS[c],
                        minWidth: SHEET_WIDTHS[c],
                        background: cellBg,
                        borderBottom: "1px solid #d9d9d9",
                        borderRight: SHEET_THICK_RIGHT.has(c) ? "2px solid #000" : "1px solid #d9d9d9",
                        outline: isSel ? "2px solid #1a73e8" : undefined,
                        outlineOffset: -2,
                        zIndex: isSel ? 10 : undefined,
                        color: !row.editable ? "#3c4043" : "#000",
                      }}
                      title={!isEdit ? display(col.type, row.values[c], col.name) : undefined}
                    >
                      {isEdit ? (
                        <CellEditor
                          type={col.type}
                          value={edit.value}
                          listId={options[col.name]?.length ? `opt-${col.name}` : undefined}
                          onChange={(v) => setEdit({ ...edit, value: v })}
                          onCommit={(v, dr, dc) => {
                            commit(r, c, v);
                            if (dr || dc) move(dr, dc);
                            focusGrid();
                          }}
                          onCancel={() => {
                            setEdit(null);
                            focusGrid();
                          }}
                        />
                      ) : (
                        display(col.type, row.values[c], col.name)
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {Object.entries(options).map(([name, list]) => (
        <datalist key={name} id={`opt-${name}`}>
          {list.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      ))}

      <div className="text-[11px] text-text-secondary">
        Ұяшықты екі рет басыңыз немесе жаза бастаңыз · Enter — сақтау және төмен · Tab — оңға · Esc — бас тарту · жебелермен жылжу ·
        Год, Мес, Остаток, Менеджер өздігінен толады · 🔒 басқа менеджердің жолы
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg ${toast.bad ? "bg-[#b42318] text-white" : "bg-[#202124] text-white"}`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function CellEditor({
  type,
  value,
  listId,
  onChange,
  onCommit,
  onCancel,
}: {
  type: string;
  value: string;
  listId?: string;
  onChange: (v: string) => void;
  onCommit: (v: string, dr: number, dc: number) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    if (type === "text" || type === "number") {
      const len = ref.current?.value.length ?? 0;
      ref.current?.setSelectionRange(len, len);
    }
  }, [type]);
  const finish = (dr: number, dc: number) => {
    if (done.current) return;
    done.current = true;
    onCommit(ref.current?.value ?? value, dr, dc);
  };
  return (
    <input
      ref={ref}
      type={type === "date" ? "date" : type === "datetime-local" ? "datetime-local" : "text"}
      inputMode={type === "number" ? "decimal" : undefined}
      list={listId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.preventDefault(), finish(1, 0));
        else if (e.key === "Tab") (e.preventDefault(), finish(0, e.shiftKey ? -1 : 1));
        else if (e.key === "Escape") (e.preventDefault(), (done.current = true), onCancel());
      }}
      onBlur={() => finish(0, 0)}
      className="absolute inset-0 z-20 h-full w-full min-w-[160px] border-2 border-[#1a73e8] bg-white px-[3px] text-[11px] outline-none"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    />
  );
}
