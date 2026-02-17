import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { addDays, startOfDayMs, endOfDayMs } from "./week.ts";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

type DayInfo = {
  date: Date;
  key: string; // YYYY-MM-DD
  totalMl: number;
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthTitle(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Lunes=0 ... Domingo=6
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

export function MonthlyCalendar({ goalMl }: { goalMl: number }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [monthOffset]);

  const monthStart = useMemo(() => {
    const d = new Date(monthDate);
    d.setDate(1);
    return d;
  }, [monthDate]);

  const monthEnd = useMemo(() => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0); // último día del mes actual
    return d;
  }, [monthDate]);

  const daysInMonth = monthEnd.getDate();

  const totalsByDay =
    useLiveQuery(async () => {
      const from = startOfDayMs(monthStart);
      const to = endOfDayMs(monthEnd);

      const rows = await db.entries.where("ts").between(from, to, true, true).toArray();

      const map: Record<string, number> = {};
      for (const e of rows) {
        const k = ymd(new Date(e.ts));
        map[k] = (map[k] ?? 0) + e.amountMl;
      }
      return map;
    }, [monthStart.getTime(), monthEnd.getTime()]) ?? {};

  const grid = useMemo(() => {
    const firstWeekday = mondayIndex(monthStart.getDay()); // 0..6 (lunes..domingo)
    const cells: (DayInfo | null)[] = [];

    // celdas vacías antes del día 1
    for (let i = 0; i < firstWeekday; i++) cells.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(monthStart);
      d.setDate(day);
      const key = ymd(d);
      cells.push({ date: d, key, totalMl: totalsByDay[key] ?? 0 });
    }

    // rellenar hasta múltiplo de 7
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [monthStart, daysInMonth, totalsByDay]);

  const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        background: "white",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
          <CalendarDays size={18} />
          Mes
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setMonthOffset((v) => v - 1)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid #e5e5e5",
              background: "white",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div style={{ fontWeight: 800, textTransform: "capitalize" }}>{monthTitle(monthStart)}</div>

          <button
            onClick={() => setMonthOffset((v) => v + 1)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid #e5e5e5",
              background: "white",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {weekdays.map((w) => (
          <div key={w} style={{ fontSize: 12, opacity: 0.7, textAlign: "center", fontWeight: 700 }}>
            {w}
          </div>
        ))}

        {grid.map((cell, idx) => {
          if (!cell) {
            return <div key={`e-${idx}`} style={{ height: 56 }} />;
          }

          const hitGoal = cell.totalMl >= goalMl;
          const intensity = Math.min(1, cell.totalMl / Math.max(goalMl, 1)); // 0..1
          const bg = hitGoal
            ? `rgba(46, 204, 113, ${0.15 + 0.55 * intensity})`
            : `rgba(52, 152, 219, ${0.10 + 0.45 * intensity})`;

          return (
            <div
              key={cell.key}
              title={`${cell.key} · ${Math.round(cell.totalMl)} ml`}
              style={{
                height: 56,
                borderRadius: 14,
                border: "1px solid #eee",
                background: cell.totalMl > 0 ? bg : "white",
                padding: 8,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13 }}>{cell.date.getDate()}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>
                {cell.totalMl > 0 ? `${Math.round(cell.totalMl)} ml` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Verde = objetivo cumplido. Azul = por debajo.
      </div>
    </div>
  );
}
