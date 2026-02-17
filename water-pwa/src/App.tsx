import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDefaultSettings } from "./db";
import type { Settings } from "./db";
import { startOfDayMs, endOfDayMs } from "./time";
import { SettingsView } from "./SettingsView";
import { expectedByNowMl, pacingStatus, nextHourGuidance } from "./pacing";
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
  BarChart3,
  Lightbulb,
  Undo2
} from "lucide-react";

function fmtMl(ml: number) {
  return `${ml} ml`;
}

// redondea hacia arriba a un botón rápido (para “ponerte en ritmo” de verdad)
function roundUpToQuick(needMl: number, quickList: number[]) {
  if (needMl <= 0) return 0;
  const sorted = [...quickList].sort((a, b) => a - b);
  const next = sorted.find((n) => n >= needMl);
  return next ?? sorted[sorted.length - 1] ?? needMl;
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(250);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"home" | "stats">("home");
  const [now, setNow] = useState(() => new Date());

  // feedback visual tipo “tap”
  const [tap, setTap] = useState(false);

  // undo toast
  const [undoInfo, setUndoInfo] = useState<null | { id: number; amountMl: number }>(null);
  const undoTimer = useRef<number | null>(null);

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

  // Tip "bebe X antes de Y"
  const stepMinutes = settings?.stepMinutes ?? 60;
  const guide = nextHourGuidance({
    now,
    wakeHour,
    sleepHour,
    dailyGoalMl: goal,
    totalTodayMl: totalToday,
    stepMinutes
  });

  const guideTime = guide.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const showGuide = ps.diff < -150 && guide.needMl > 0; // umbral
  const guideRoundedMl = roundUpToQuick(guide.needMl, quickList);

  function startUndoTimer() {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => {
      setUndoInfo(null);
      undoTimer.current = null;
    }, 5000);
  }

  async function add(amountMl: number) {
    // tap visual
    setTap(true);
    window.setTimeout(() => setTap(false), 140);

    const id = (await db.entries.add({ ts: Date.now(), amountMl, type: "water" })) as number;

    setUndoInfo({ id, amountMl });
    startUndoTimer();
  }

  async function undoLast() {
    if (!undoInfo) return;
    await db.entries.delete(undoInfo.id);
    setUndoInfo(null);
    if (undoTimer.current) {
      window.clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  }

  async function remove(id?: number) {
    if (!id) return;
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
        minHeight: "100vh"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, letterSpacing: -0.5 }}>WaterReminder</h1>

        <button
          onClick={() => setShowSettings(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.06)",
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
              background: "rgba(20,20,20,0.98)",
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderBottom: "1px solid rgba(255,255,255,0.10)"
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
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.06)"
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
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.06)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.75, display: "flex", alignItems: "center", gap: 6 }}>
                  <Droplets size={16} />
                  Hoy
                </div>

                <div style={{ fontSize: 34, fontWeight: 900, marginTop: 2 }}>{fmtMl(totalToday)}</div>

                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.85,
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
                    <strong style={{ fontWeight: 900 }}>{ps.label}</strong> ({diffText})
                  </span>
                </div>

                {/* Tip + botón “Añadir ahora” */}
                {showGuide && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.06)",
                      fontSize: 13,
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start"
                    }}
                  >
                    <Lightbulb size={18} style={{ marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      Para ir en ritmo, bebe{" "}
                      <strong>{guideRoundedMl} ml</strong> antes de{" "}
                      <strong>{guideTime}</strong>.
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => add(guideRoundedMl)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 12px",
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(78,161,255,0.95)",
                            color: "#061018",
                            fontWeight: 900
                          }}
                          aria-label={`Añadir recomendación ${guideRoundedMl} ml`}
                        >
                          <Droplets size={18} />
                          Añadir ahora
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <select
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(Number(e.target.value))}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)"
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
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(78,161,255,0.95)",
                    color: "#061018",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 900,
                    transform: tap ? "scale(0.97)" : "scale(1)",
                    transition: "transform 140ms ease, filter 140ms ease",
                    filter: tap ? "drop-shadow(0 10px 22px rgba(78,161,255,0.35))" : "none"
                  }}
                  aria-label={`Añadir ${quickAmount} ml`}
                >
                  <Droplets size={18} />
                  + {quickAmount} ml
                </button>
              </div>
            </div>

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
                  background: pct >= 100 ? "rgba(53,208,127,0.95)" : ps.diff < -150 ? "rgba(255,91,110,0.95)" : "rgba(78,161,255,0.95)",
                  borderRadius: 999,
                  transition: "width 0.35s ease"
                }}
              />
            </div>
          </div>

          {/* Registros */}
          <h2 style={{ marginTop: 18, marginBottom: 10, fontSize: 20, fontWeight: 900 }}>Registros de hoy</h2>

          {todayEntries.length === 0 ? (
            <div style={{ opacity: 0.75 }}>Aún no has registrado nada.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {todayEntries.map((e) => (
                <li
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.10)"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>{fmtMl(e.amountMl)}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{new Date(e.ts).toLocaleTimeString()}</div>
                  </div>
                  <button
                    onClick={() => remove(e.id)}
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      padding: "8px 10px"
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

      {/* UNDO toast */}
      {undoInfo && (
        <div
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 92,
            display: "flex",
            justifyContent: "center",
            zIndex: 60
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 16,
              padding: "12px 12px",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(20,20,20,0.92)",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Añadido <strong>{undoInfo.amountMl} ml</strong>
            </div>
            <button
              onClick={undoLast}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.06)",
                fontWeight: 900
              }}
              aria-label="Deshacer último añadido"
            >
              <Undo2 size={16} />
              Deshacer
            </button>
          </div>
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
          background: "rgba(11,15,20,0.82)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(255,255,255,0.10)"
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", gap: 10 }}>
          <button
            onClick={() => setTab("home")}
            style={{
              flex: 1,
              padding: "12px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: tab === "home" ? "rgba(78,161,255,0.95)" : "rgba(255,255,255,0.06)",
              color: tab === "home" ? "#061018" : "rgba(255,255,255,0.92)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontWeight: 950
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
              border: "1px solid rgba(255,255,255,0.10)",
              background: tab === "stats" ? "rgba(78,161,255,0.95)" : "rgba(255,255,255,0.06)",
              color: tab === "stats" ? "#061018" : "rgba(255,255,255,0.92)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontWeight: 950
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
