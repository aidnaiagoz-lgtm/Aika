"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SHEET_WIDTHS, SHEET_THICK_RIGHT, SHEET_HEADERS, COMPUTED_FIELDS, LIST_FIELDS, cellColor, columnLetter, CHECKBOX_FIELDS, isChecked, SHEET_ALIGN } from "@/lib/domain/sales-ledger/sheet-layout";
import type { ClientRow } from "./client-row";
import { updateCellAction, createRowAction } from "./sheet-actions";

// Google Sheets-ке ұқсас кесте: 45 баған (A..AS), таблицадағы ені/түстері, ұяшықты басып өзгерту,
// жебелер / Enter / Tab / Esc, ашылмалы тізімдер. Тек көрінетін жолдар салынады (виртуализация).

type Col = { name: string; type: string };

const ROW_H = 22;
const HEAD_H = 40;
const LETTER_H = 20;
const NUM_W = 46;
const OVERSCAN = 15;
// Google таблицадағыдай — деректердің астында бос жолдар: жаза бастасаң, жаңа сатылым өзі ашылады
const BLANK_ROWS = 40;
const isBlank = (row: ClientRow) => row.id.startsWith("blank:");
// Таблицадағыдай ашылмалы тізім белгісі (▾) бар бағандар
const DROPDOWN = new Set<string>([...LIST_FIELDS, "manager", "carYear"]);

const fmtNum = new Intl.NumberFormat("ru-RU");

/**
 * Сервер әрекетін қауіпсіз шақыру. Желі үзілсе немесе сайттың жаңа нұсқасы шыққан болса
 * (ескі беттегі әрекет сервердан табылмайды) — бет ақ болып қалмасын: қате қайтарамыз,
 * жаңа нұсқа болса бетті өзі қайта жүктейміз.
 */
async function safe<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/server action|failed to find|not found|unexpected response/i.test(msg)) {
      window.setTimeout(() => window.location.reload(), 1200);
      return { ok: false, error: "Сайт жаңарды — бет қайта ашылып жатыр…" };
    }
    return { ok: false, error: "Байланыс үзілді — қайта көріңіз" };
  }
}

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
}: {
  columns: Col[];
  initialRows: ClientRow[];
  options: Record<string, string[]>;
  priceByProduct: Record<string, number>;
  canAdd: boolean;
  readOnlyReason: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const query = "";
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

  // Сайттағы толтыру режимінде сервер жаңартуы жергілікті өзгерістердің үстінен жазылмасын.
  // Google таблица режимінде — кесте таблицаның көшірмесі: әр минут сайын жаңа жолдарды өзі тартады.
  const router = useRouter();
  useEffect(() => {
    if (readOnlyReason) setRows(initialRows);
  }, [initialRows, readOnlyReason]);
  useEffect(() => {
    if (!readOnlyReason) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [readOnlyReason, router]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.values.some((v) => v !== null && String(v).toLowerCase().includes(q)));
  }, [rows, query]);

  const gridRows = useMemo(() => {
    if (!canAdd || query.trim()) return visibleRows;
    const blanks: ClientRow[] = Array.from({ length: BLANK_ROWS }, (_, i) => ({
      id: `blank:${i}`,
      createdById: null,
      editable: true,
      values: columns.map(() => null),
    }));
    return [...visibleRows, ...blanks];
  }, [visibleRows, canAdd, query, columns]);

  const statusIdx = columns.findIndex((c) => c.name === "orderStatus");
  const lastNo = Number(visibleRows[visibleRows.length - 1]?.values[0] ?? 0);
  const remainderIdx = columns.findIndex((c) => c.name === "remainder");

  // Соңғы мәліметтер — асинхронды сақтау кезінде ескі көшірмеге сүйенбеу үшін
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Бос жолдан жаңа сатылым жасалып жатқанда — сол жолға жазылған келесі ұяшықтар соны күтеді
  const creating = useRef<Promise<ClientRow | null> | null>(null);

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
    // Таблицадағыдай — ашылғанда соңғы жазбалар мен бос жолдар көрінсін
    if (canAdd) el.scrollTop = Math.max(0, (rows.length - 5) * ROW_H);
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const last = Math.min(gridRows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);

  const flash = (text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast(null), bad ? 4000 : 1500);
  };

  const cellEditable = useCallback(
    (r: number, c: number) => {
      const row = gridRows[r];
      return !readOnlyReason && !!row?.editable && !COMPUTED_FIELDS.has(columns[c].name);
    },
    [gridRows, columns, readOnlyReason]
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
        const r = Math.min(Math.max(cur.r + dr, 0), Math.max(gridRows.length - 1, 0));
        const c = Math.min(Math.max(cur.c + dc, 0), columns.length - 1);
        ensureVisible(r, c);
        return { r, c };
      });
    },
    [gridRows.length, columns.length, ensureVisible]
  );

  const commit = useCallback(
    (r: number, c: number, value: string) => {
      const row = gridRows[r];
      const col = columns[c];
      setEdit(null);
      if (!row) return;
      const before = editValue(col.type, row.values[c]);
      if (value === before) return;
      if (isBlank(row)) return createFrom(r, c, value);
      // Оптимистік көрініс
      const optimistic = row.values.slice();
      optimistic[c] = value === "" ? null : col.type === "number" ? Number(value.replace(/\s/g, "").replace(",", ".")) : value;
      setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, values: optimistic } : x)));
      setSaving((n) => n + 1);
      startTransition(async () => {
        const res = await safe(() => updateCellAction(row.id, col.name, value));
        setSaving((n) => n - 1);
        if (res.ok) {
          setRows((rs) => rs.map((x) => (x.id === row.id ? res.row : x)));
          // Тауар таңдалса — бағасы бос болса, соңғы бағасын қоямыз (таблицадағы VLOOKUP сияқты)
          if (col.name === "product" && value && priceByProduct[value] != null) {
            const pi = columns.findIndex((x) => x.name === "price");
            if (pi >= 0 && res.row.values[pi] == null) {
              const r2 = await safe(() => updateCellAction(row.id, "price", String(priceByProduct[value])));
              if (r2.ok) setRows((rs) => rs.map((x) => (x.id === row.id ? r2.row : x)));
            }
          }
        } else {
          setRows((rs) => rs.map((x) => (x.id === row.id ? row : x)));
          flash(res.error, true);
        }
      });
    },
    [gridRows, columns, priceByProduct]
  );

  const startEdit = (r: number, c: number, initial?: string): void => {
    if (!cellEditable(r, c)) {
      const row = gridRows[r];
      if (readOnlyReason) flash(readOnlyReason, true);
      else if (row && !row.editable) flash("🔒 Бұл жолды тек оны енгізген менеджер өзгерте алады", true);
      else flash("Бұл баған өздігінен толады", true);
      return;
    }
    if (CHECKBOX_FIELDS.has(columns[c].name)) {
      toggleBox(r, c);
      return;
    }
    setEdit({ r, c, value: initial ?? editValue(columns[c].type, gridRows[r].values[c]) });
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

  /** Құсбелгіні ауыстыру (басу / Enter / бос орын). */
  const toggleBox = (r: number, c: number): void => {
    if (!cellEditable(r, c)) {
      const row = gridRows[r];
      flash(readOnlyReason ?? (row && !row.editable ? "🔒 Бұл жолды тек оны енгізген менеджер өзгерте алады" : "Бұл баған өздігінен толады"), true);
      return;
    }
    commit(r, c, isChecked(gridRows[r]?.values[c]) ? "false" : "true");
  };

  /** Бос жолға жазылды — жаңа сатылым ашамыз (Дата — бүгін, Менеджер — өзі) және сол мәнді сақтаймыз. */
  const createFrom = (r: number, c: number, value: string) => {
    if (value.trim() === "") return;
    const col = columns[c];
    const realCount = visibleRows.length;
    setSaving((n) => n + 1);
    startTransition(async () => {
      // Алдыңғы бос жолдан жаңа сатылым әлі ашылып жатса — соны күтеміз (екі жол болып кетпесін)
      const prev = creating.current ? await creating.current : null;
      const target = prev && rowsRef.current.findIndex((x) => x.id === prev.id) === r ? prev : null;
      if (target) {
        const res = await safe(() => updateCellAction(target.id, col.name, value));
        setSaving((n) => n - 1);
        if (!res.ok) return flash(res.error, true);
        setRows((rs) => rs.map((x) => (x.id === target.id ? res.row : x)));
        return;
      }
      const p = (async () => {
        const res = await safe(() => createRowAction(col.name, value));
        if (!res.ok) {
          flash(res.error, true);
          return null;
        }
        let row = res.row;
        // Тауар таңдалса — соңғы бағасын қоямыз (таблицадағы VLOOKUP сияқты)
        if (col.name === "product" && priceByProduct[value] != null) {
          const r2 = await safe(() => updateCellAction(row.id, "price", String(priceByProduct[value])));
          if (r2.ok) row = r2.row;
        }
        setRows((rs) => [...rs, row]);
        return row;
      })();
      creating.current = p;
      const created = await p;
      setSaving((n) => n - 1);
      if (creating.current === p) creating.current = null;
      if (created) {
        // Төменірек бос жолға жазылса да — жаңа сатылым деректердің соңына тұрады
        if (r !== realCount) setSel((s) => (s && s.r === r ? { r: realCount, c: s.c } : s));
        flash("Жаңа сатылым ашылды ✓");
      }
    });
  };

  const totalH = LETTER_H + HEAD_H + gridRows.length * ROW_H;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        className="relative h-[calc(100vh-200px)] min-h-[420px] overflow-auto border border-[#c0c0c0] bg-white outline-none"
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
          {gridRows.slice(first, last).map((row, i) => {
            const r = first + i;
            const blank = isBlank(row);
            const status = row.values[statusIdx] as string | null;
            const remainder = row.values[remainderIdx];
            return (
              <div key={row.id} className="absolute flex" style={{ top: LETTER_H + HEAD_H + r * ROW_H, height: ROW_H, width: lefts.total }}>
                <div
                  className={`sticky left-0 z-20 flex items-center justify-center border-b border-r border-[#c0c0c0] text-[10px] ${sel?.r === r ? "bg-[#d3e3fd] font-bold text-[#0b57d0]" : "bg-[#f8f9fa] text-[#5f6368]"}`}
                  style={{ width: NUM_W, minWidth: NUM_W }}
                  title={blank ? "Жаза бастаңыз — жаңа сатылым ашылады" : row.editable ? "Сіздің жолыңыз" : "Тек оқу"}
                >
                  {blank ? lastNo + 2 + (r - visibleRows.length) : Number(row.values[0]) + 1}
                </div>
                {columns.map((col, c) => {
                  const isSel = sel?.r === r && sel?.c === c;
                  const isEdit = edit?.r === r && edit?.c === c;
                  const cellBg = cellColor(c, status, remainder);
                  const isBox = CHECKBOX_FIELDS.has(col.name);
                  return (
                    <div
                      key={col.name}
                      onMouseDown={(e) => {
                        if (isEdit) return;
                        e.preventDefault();
                        setSel({ r, c });
                        focusGrid();
                        // Таблицадағыдай — құсбелгіні бір басқанда ауыстырады
                        if (isBox && (e.target as HTMLElement).dataset.box) toggleBox(r, c);
                      }}
                      onDoubleClick={() => startEdit(r, c)}
                      className={`relative overflow-hidden whitespace-nowrap px-[3px] leading-[21px] ${isBox ? "flex items-center justify-center" : SHEET_ALIGN[c] === "right" ? "text-right" : SHEET_ALIGN[c] === "center" ? "text-center" : "text-left"}`}
                      style={{
                        width: SHEET_WIDTHS[c],
                        minWidth: SHEET_WIDTHS[c],
                        background: cellBg,
                        borderBottom: "1px solid #d9d9d9",
                        borderRight: SHEET_THICK_RIGHT.has(c) ? "2px solid #000" : "1px solid #d9d9d9",
                        outline: isSel ? "2px solid #1a73e8" : undefined,
                        outlineOffset: -2,
                        zIndex: isSel ? 10 : undefined,
                        color: "#000",
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
                      ) : isBox ? (
                        <CheckBox checked={isChecked(row.values[c])} bg={cellBg} />
                      ) : DROPDOWN.has(col.name) ? (
                        <>
                          <span className="block overflow-hidden pr-3">{display(col.type, row.values[c], col.name)}</span>
                          <span className="pointer-events-none absolute right-[3px] top-0 text-[9px] text-[#5f6368]">▼</span>
                        </>
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

/** Google таблицадағы құсбелгі: түсі жол түсіне қарай (сары — алтын, жасыл — жасыл). */
function CheckBox({ checked, bg }: { checked: boolean; bg: string }) {
  const color = bg === "#b7e1cd" ? "#1e7145" : bg === "#f4c7c3" ? "#a61c00" : "#b78700";
  return (
    <span
      data-box="1"
      className="flex h-[13px] w-[13px] cursor-pointer items-center justify-center rounded-[2px]"
      style={{ border: `1.5px solid ${checked ? color : bg === "#ffffff" ? "#5f6368" : color}`, background: checked ? color : "transparent" }}
    >
      {checked && (
        <svg data-box="1" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" strokeWidth="2">
          <path data-box="1" d="M2.5 6.2l2.3 2.3 4.7-5" />
        </svg>
      )}
    </span>
  );
}
