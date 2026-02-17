import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDefaultSettings } from "./db";
import type { Settings } from "./db";
import { startOfDayMs, endOfDayMs } from "./time";
import { SettingsView } from "./SettingsView";
import { expectedByNowMl, pacingStatus } from "./pacing";
import { WeeklyChart } from "./WeeklyChart";
import { WavesHero } from "./Illustrations";

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
      const rows = await db.entries
        .where("ts")
        .between(from, to, true, true)
        .toArray();
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
        background: "#0b0f14",
        color: "rgba(255,255,255,0.92)",
        minHeight: "100vh"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 40,
            letterSpacing: -0.8,
            fontWeight: 800
          }}
        >
          Hydro
        </h1>

        <button
          onClick={() => setShowSettings((v) => !v)}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "#4ea1ff",
            fontWeight: 700
          }}
        >
          {showSettings ? "Cerrar" : "Ajustes"}
        </button>
      </div>

      {showSettings && (
        <div style={{ marginTop: 12 }}>
          <SettingsView />
        </div>
      )}

      {/* Card principal */}
      <div
        style={{
          marginTop: 14,
          padding: 16,
          borderRadius: 18,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
          overflow: "hidden"
        }}
      >
        {/* Ilustración / Hero */}
        <div style={{ margin: "-16px -16px 14px", borderRadius: 18, overflow: "hidden" }}>
          <WavesHero progress={goal > 0 ? totalToday / goal : 0} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>Hoy</div>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{fmtMl(totalToday)}</div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>
              Objetivo: {fmtMl(goal)} · {pct}%
            </div>
            <div style={{ fontSize: 14, marginTop: 8, opacity: 0.92 }}>
              A esta hora: {fmtMl(expected)} · <strong>{ps.label}</strong> ({diffText})
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <select
              value={quickAmount}
              onChange={(e) => setQuickAmount(Number(e.target.value))}
              style={{
                borderRadius: 999,
                padding: "8px 10px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.25)"
              }}
            >
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
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.10)",
                color: "#4ea1ff",
                fontWeight: 800
              }}
            >
              + {quickAmount} ml
            </button>
          </div>
        </div>

        {/* Barra de progreso */}
        <div
          style={{
            marginTop: 14,
            width: "100%",
            height: 12,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.10)"
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background:
                pct >= 100
                  ? "rgba(53,208,127,0.95)"
                  : ps.diff < -150
                  ? "rgba(255,91,110,0.95)"
                  : "rgba(78,161,255,0.95)",
              borderRadius: 999,
              transition: "width 0.35s ease"
            }}
          />
        </div>
      </div>

      {/* Semana */}
      <div style={{ marginTop: 16 }}>
        <WeeklyChart goalMl={goal} />
      </div>

      {/* Lista */}
      <h2 style={{ marginTop: 22, marginBottom: 10, fontSize: 22, fontWeight: 800 }}>
        Registros de hoy
      </h2>

      {todayEntries.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Aún no has registrado nada.</div>
      ) : (
        <div
          style={{
            borderRadius: 18,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
            overflow: "hidden"
          }}
        >
          {todayEntries.map((e) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.08)"
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{fmtMl(e.amountMl)}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(e.ts).toLocaleTimeString()}
                </div>
              </div>

              <button
                onClick={() => remove(e.id)}
                style={{
                  borderRadius: 12,
                  padding: "8px 10px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  opacity: 0.9
                }}
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
