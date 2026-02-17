import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDefaultSettings } from "./db";
import type { Settings } from "./db";
import { startOfDayMs, endOfDayMs } from "./time";
import { SettingsView } from "./SettingsView";
import { expectedByNowMl, pacingStatus } from "./pacing";
import { WeeklyChart } from "./WeeklyChart";

function fmtMl(ml: number) {
  return `${ml} ml`;
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(250);
  const [showSettings, setShowSettings] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Tick cada minuto para recalcular ritmo
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Inicializa settings
  useEffect(() => {
    (async () => {
      await ensureDefaultSettings();
      setSettings((await db.settings.get("me")) ?? null);
    })();
  }, []);

  // Mantener settings en vivo
  const liveSettings =
    useLiveQuery(async () => (await db.settings.get("me")) ?? null, []) ?? null;

  useEffect(() => {
    if (liveSettings) setSettings(liveSettings);
  }, [liveSettings]);

  // Entradas de hoy
  const todayEntries =
    useLiveQuery(async () => {
      const today = new Date();
      const from = startOfDayMs(today);
      const to = endOfDayMs(today);
      const rows = await db.entries.where("ts").between(from, to, true, true).toArray();
      return rows.sort((a, b) => b.ts - a.ts);
    }, []) ?? [];

  const totalToday = useMemo(
    () => todayEntries.reduce((sum, e) => sum + e.amountMl, 0),
    [todayEntries]
  );

  const goal = settings?.dailyGoalMl ?? 2000;
  const pct = Math.min(100, Math.round((totalToday / goal) * 100));
  const quickList = settings?.quickAmountsMl ?? [150, 250, 330, 500, 750];

  // Ajustar quickAmount si cambia lista
  useEffect(() => {
    if (!quickList.includes(quickAmount)) {
      setQuickAmount(quickList[0] ?? 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.quickAmountsMl]);

  // Ritmo esperado
  const wakeHour = settings?.wakeHour ?? 9;
  const sleepHour = settings?.sleepHour ?? 22;

  const expected = expectedByNowMl({
    now,
    wakeHour,
    sleepHour,
    dailyGoalMl: goal
  });

  const ps = pacingStatus(totalToday, expected);
  const diffText =
    ps.diff === 0 ? "0 ml" : `${ps.diff > 0 ? "+" : ""}${ps.diff} ml`;

  async function add(amountMl: number) {
    await db.entries.add({ ts: Date.now(), amountMl, type: "water" });
  }

  async function remove(id?: number) {
    if (!id) return;
    await db.entries.delete(id);
  }


  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui",
        background: "#fafafa",
        minHeight: "100vh"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Hydro</h1>
        <button onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? "Cerrar" : "Ajustes"}
        </button>
      </div>

      {showSettings && (
        <div style={{ marginTop: 12 }}>
          <SettingsView />
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          padding: 16,
          borderRadius: 16,
          background: "white",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.6 }}>Hoy</div>

        <div style={{ fontSize: 32, fontWeight: 700 }}>{fmtMl(totalToday)}</div>

        <div style={{ fontSize: 14, opacity: 0.7 }}>
          Objetivo: {fmtMl(goal)} · {pct}%
        </div>

        <div style={{ fontSize: 14, marginTop: 6 }}>
          A esta hora: {fmtMl(expected)} · <strong>{ps.label}</strong> ({diffText})
        </div>

        <div
          style={{
            marginTop: 12,
            width: "100%",
            height: 12,
            background: "#eee",
            borderRadius: 999
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: pct >= 100 ? "#2ecc71" : ps.diff < -150 ? "#e74c3c" : "#3498db",
              borderRadius: 999,
              transition: "width 0.3s ease"
            }}
          />
        </div>

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <select value={quickAmount} onChange={(e) => setQuickAmount(Number(e.target.value))}>
            {quickList.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <div style={{ height: 8 }} />
          <button
            onClick={() => add(quickAmount)}
            style={{
              padding: "12px 18px",
              fontSize: 16,
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "white"
            }}
          >
            + {quickAmount} ml
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <WeeklyChart goalMl={goal} />
      </div>

      <h2 style={{ marginTop: 24 }}>Registros de hoy</h2>

      {todayEntries.length === 0 ? (
        <div style={{ opacity: 0.6 }}>Aún no has registrado nada.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {todayEntries.map((e) => (
            <li
              key={e.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #eee"
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{fmtMl(e.amountMl)}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {new Date(e.ts).toLocaleTimeString()}
                </div>
              </div>
              <button onClick={() => remove(e.id)}>Borrar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
