import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { addDays, dayLabel, startOfDayMs, endOfDayMs } from "./week.ts";
import { Flame } from "lucide-react";

type DayStat = {
  day: Date;
  totalMl: number;
};

function computeStreak(days: DayStat[], goalMl: number) {
  // days viene ordenado de más antiguo -> hoy (7 días)
  // Racha: cuenta días consecutivos alcanzando el objetivo,
  // terminando en HOY si hoy ya se cumplió; si no, termina en AYER.
  if (days.length === 0) return 0;

  const lastIdx = days.length - 1;
  const startIdx = days[lastIdx].totalMl >= goalMl ? lastIdx : lastIdx - 1;

  let streak = 0;
  for (let i = startIdx; i >= 0; i--) {
    if (days[i].totalMl >= goalMl) streak++;
    else break;
  }
  return Math.max(0, streak);
}

export function WeeklyChart({ goalMl }: { goalMl: number }) {
  const stats =
    useLiveQuery(async (): Promise<DayStat[]> => {
      const today = new Date();
      const days: DayStat[] = [];

      for (let i = 6; i >= 0; i--) {
        const day = addDays(today, -i);
        const from = startOfDayMs(day);
        const to = endOfDayMs(day);

        const rows = await db.entries.where("ts").between(from, to, true, true).toArray();
        const totalMl = rows.reduce((sum, e) => sum + e.amountMl, 0);
        days.push({ day, totalMl });
      }

      return days;
    }, []) ?? [];

  // Render “loading” en vez de null
  if (stats.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 16,
          background: "white",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Semana</h2>
        <div style={{ marginTop: 8, opacity: 0.7 }}>Cargando…</div>
      </div>
    );
  }

  const streak = computeStreak(stats, goalMl);
  const maxMl = Math.max(goalMl, ...stats.map((s) => s.totalMl), 1);

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background: "white",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Semana</h2>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Objetivo: {goalMl} ml</div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 999,
            border: "1px solid #e5e5e5",
            background: "white",
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap"
          }}
          title="Días consecutivos cumpliendo el objetivo"
        >
          <Flame size={16} />
          {streak === 0 ? "Sin racha" : `${streak} día${streak === 1 ? "" : "s"} de racha`}
        </div>
      </div>

      {/* Gap extra (como pediste) */}
      <div style={{ height: 18 }} />

      {/* Bars */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 140 }}>
        {stats.map((s, idx) => {
          const rawH = Math.round((s.totalMl / maxMl) * 120);
          const h = s.totalMl > 0 ? Math.max(4, rawH) : 0; // barra mínima si hay algo
          const hitGoal = s.totalMl >= goalMl;
          const isToday = idx === stats.length - 1;

          return (
            <div key={s.day.toISOString()} style={{ flex: 1, minWidth: 0 }}>
              <div
                title={`${Math.round(s.totalMl)} ml`}
                style={{
                  height: 120,
                  display: "flex",
                  alignItems: "flex-end",
                  background: "#f3f3f3",
                  borderRadius: 10,
                  overflow: "hidden",
                  outline: isToday ? "2px solid #111" : "none",
                  outlineOffset: isToday ? 2 : 0
                }}
              >
                <div
                  style={{
                    height: h,
                    width: "100%",
                    background: hitGoal ? "#2ecc71" : "#3498db",
                    transition: "height 0.2s ease"
                  }}
                />
              </div>

              <div style={{ marginTop: 6, fontSize: 12, textAlign: "center", opacity: 0.85 }}>
                {dayLabel(s.day)}
              </div>
              <div style={{ fontSize: 11, textAlign: "center", opacity: 0.65 }}>
                {Math.round(s.totalMl)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
