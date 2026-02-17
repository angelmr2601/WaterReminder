import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDefaultSettings } from "./db";
import type { Settings } from "./db";
import { startOfDayMs, endOfDayMs } from "./time";
import { SettingsView } from "./SettingsView";
import { expectedByNowMl, pacingStatus } from "./pacing";
import { StatsView } from "./StatsView";

import {
  Settings as SettingsIcon,
  X as XIcon,
  Droplets,
  Target,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  Home,
  BarChart3
} from "lucide-react";

function fmtMl(ml: number) {
  return `${ml} ml`;
}

function hapticLight() {
  navigator.vibrate?.([8, 30, 8]);
}


export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(250);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"home" | "stats">("home");
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
  const diffText = ps.diff === 0 ? "0 ml" : `${ps.diff > 0 ? "+" : ""}${ps.diff} ml`;
  const PaceIcon = ps.diff === 0 ? Minus : ps.diff < 0 ? TrendingDown : TrendingUp;

  async function add(amountMl: number) {
    await db.entries.add({ ts: Date.now(), amountMl, type: "water" });
  }

  async function remove(id?: number) {
    if (!id) return;
    hapticLight();
    await db.entries.delete(id);
  }

  // Cerrar modal: tecla ESC
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui",
        background: "#fafafa",
        minHeight: "100vh",
        color: "#111"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, letterSpacing: -0.5 }}>Hydro</h1>

        <button
          onClick={() => setShowSettings(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            background: "white",
            color: "#111",
            fontWeight: 800
          }}
          aria-label="Abrir ajustes"
        >
          <SettingsIcon size={18} />
          Ajustes
        </button>
      </div>

      {/* Modal Ajustes */}
      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: 12,
            zIndex: 50
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              overflow: "hidden",
              color: "#111"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderBottom: "1px solid #eee"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                <SettingsIcon size={18} />
                Ajustes
              </div>

              <button
                onClick={() => setShowSettings(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid #eee",
                  background: "white"
                }}
                aria-label="Cerrar ajustes"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div style={{ padding: 12, maxHeight: "75vh", overflow: "auto" }}>
              <SettingsView />
            </div>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {tab === "home" ? (
        <>
          {/* Tarjeta principal (Hoy) */}
          <div
            style={{
              marginTop: 12,
              padding: 16,
              borderRadius: 16,
              background: "white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.65,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Droplets size={16} />
                  Hoy
                </div>

                <div style={{ fontSize: 34, fontWeight: 800, marginTop: 2 }}>{fmtMl(totalToday)}</div>

                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.75,
                    marginTop: 6,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap"
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Target size={16} />
                    Objetivo: {fmtMl(goal)} · {pct}%
                  </span>

                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Clock size={16} />
                    A esta hora: {fmtMl(expected)}
                  </span>

                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <PaceIcon size={16} />
                    <strong style={{ fontWeight: 800 }}>{ps.label}</strong> ({diffText})
                  </span>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <select
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(Number(e.target.value))}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid #e5e5e5",
                    background: "white",
                    color: "#111"
                  }}
                  aria-label="Cantidad rápida"
                >
                  {quickList.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <div style={{ height: 10 }} />

                <button
                  onClick={() => add(quickAmount)}
                  style={{
                    padding: "12px 16px",
                    fontSize: 16,
                    borderRadius: 14,
                    border: "none",
                    background: "#111",
                    color: "white",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 800
                  }}
                  aria-label={`Añadir ${quickAmount} ml`}
                >
                  <Droplets size={18} />
                  + {quickAmount} ml
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14, width: "100%", height: 12, background: "#eee", borderRadius: 999 }}>
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
          </div>

          {/* Registros */}
          <h2 style={{ marginTop: 18, marginBottom: 10 }}>Registros de hoy</h2>

          {todayEntries.length === 0 ? (
            <div style={{ opacity: 0.65 }}>Aún no has registrado nada.</div>
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
                    <div style={{ fontWeight: 800 }}>{fmtMl(e.amountMl)}</div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>{new Date(e.ts).toLocaleTimeString()}</div>
                  </div>
                  <button
                    onClick={() => remove(e.id)}
                    style={{
                      border: "1px solid #eee",
                      background: "white",
                      borderRadius: 12,
                      padding: "8px 10px",
                      color: "#111"
                    }}
                  >
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div style={{ marginTop: 12 }}>
          <StatsView goalMl={goal} />
        </div>
      )}

      {/* Spacer for bottom tab bar */}
      <div style={{ height: 86 }} />

      {/* Bottom Tab Bar */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 12,
          background: "rgba(250,250,250,0.9)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid #eee"
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", gap: 10 }}>
          <button
            onClick={() => setTab("home")}
            style={{
              flex: 1,
              padding: "12px 12px",
              borderRadius: 14,
              border: "1px solid #e5e5e5",
              background: tab === "home" ? "#111" : "white",
              color: tab === "home" ? "white" : "#111",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontWeight: 900
            }}
            aria-label="Ir a Hoy"
          >
            <Home size={18} />
            Hoy
          </button>

          <button
            onClick={() => setTab("stats")}
            style={{
              flex: 1,
              padding: "12px 12px",
              borderRadius: 14,
              border: "1px solid #e5e5e5",
              background: tab === "stats" ? "#111" : "white",
              color: tab === "stats" ? "white" : "#111",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontWeight: 900
            }}
            aria-label="Ir a Estadísticas"
          >
            <BarChart3 size={18} />
            Stats
          </button>
        </div>
      </div>
    </div>
  );
}
